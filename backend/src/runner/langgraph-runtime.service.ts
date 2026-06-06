import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Annotation, BaseCheckpointSaver, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { createHash } from 'crypto';
import * as mongoose from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from '../constants-global';
import { getErrorDetails, logEvent } from '../observability/observability';

export type CanvasFlowLangGraphQueueItem = {
  stepId: string;
  readyAt: number;
  delayMs: number;
};

export type CanvasFlowLangGraphStatus = 'running' | 'waiting' | 'completed' | 'ended' | 'limit';

export type CanvasFlowLangGraphState = {
  runId: string;
  queue: CanvasFlowLangGraphQueueItem[];
  completed: string[];
  visitCountByStep: Record<string, number>;
  waitingInput: string;
  ended: boolean;
  safety: number;
  maxExecutionSteps: number;
  maxStepVisits: number;
  activeFlowId: string;
  activeFlowName: string;
  clearConversationMemory: boolean;
  context: Record<string, any>;
  messages: Array<Record<string, any>>;
  trace: any[];
  traceDropped: number;
  checkpoints: number;
  status: CanvasFlowLangGraphStatus;
  updatedAt: string;
};

export type CanvasFlowLangGraphThreadScope = {
  organizationId?: string;
  ownerId?: string;
  agentId?: string;
  entryFlowId?: string;
  flowId?: string;
  conversationId: string;
};

export type CanvasFlowLangGraphRuntimeMetadata = {
  engine: 'langgraph';
  durable: boolean;
  storage: 'mongodb' | 'memory';
  threadId: string;
  checkpointNamespace: string;
  checkpoints: number;
  recovered: boolean;
  status: CanvasFlowLangGraphStatus;
};

const RuntimeAnnotation = Annotation.Root({
  runtime: Annotation<CanvasFlowLangGraphState>(),
});

@Injectable()
export class LangGraphRuntimeService {
  private readonly memorySaver = new MemorySaver();
  private mongoSaver?: MongoDBSaver;
  private mongoClient?: any;
  private mongoIndexesReady?: Promise<void>;

  constructor(
    @Optional() @Inject(STRING_URL_DATABASE_CONNECTION) private readonly databaseConnection?: typeof mongoose,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  createThreadId(scope: CanvasFlowLangGraphThreadScope) {
    const digest = createHash('sha256')
      .update(JSON.stringify({
        organizationId: String(scope.organizationId || 'global'),
        ownerId: String(scope.ownerId || 'anonymous'),
        agentId: String(scope.agentId || 'default-agent'),
        entryFlowId: String(scope.entryFlowId || 'inline-flow'),
        flowId: String(scope.flowId || scope.entryFlowId || 'inline-flow'),
        conversationId: String(scope.conversationId || ''),
      }))
      .digest('hex');
    return `canvas-flow:${digest}`;
  }

  private checkpointNamespace() {
    return String(this.configService?.get<string>('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_NAMESPACE') || 'canvas-flow-runtime-v1');
  }

  private checkpointCollectionName() {
    return String(this.configService?.get<string>('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_COLLECTION') || 'canvas_langgraph_checkpoints');
  }

  private checkpointWritesCollectionName() {
    return String(this.configService?.get<string>('CANVAS_FLOW_LANGGRAPH_WRITES_COLLECTION') || 'canvas_langgraph_checkpoint_writes');
  }

  private checkpointTtlSeconds() {
    const hours = Number(this.configService?.get<string>('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_TTL_HOURS') || 720);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.max(3600, Math.floor(hours * 60 * 60));
  }

  private checkpointIndexRetryAttempts() {
    const attempts = Number(this.configService?.get<string>('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_ATTEMPTS') || 3);
    if (!Number.isFinite(attempts)) return 3;
    return Math.max(1, Math.min(10, Math.floor(attempts)));
  }

  private checkpointIndexRetryDelayMs() {
    const delayMs = Number(this.configService?.get<string>('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_DELAY_MS') || 250);
    if (!Number.isFinite(delayMs)) return 250;
    return Math.max(0, Math.min(5000, Math.floor(delayMs)));
  }

  private isTransientMongoError(error: any) {
    const name = String(error?.name || '');
    const message = String(error?.message || '');
    return [
      'MongoNetworkError',
      'MongoNetworkTimeoutError',
      'MongoServerSelectionError',
      'MongoTopologyClosedError',
    ].includes(name) || /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|connection.*closed|socket/i.test(message);
  }

  private async wait(delayMs: number) {
    if (delayMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private getMongoConnection() {
    return this.databaseConnection?.connection || mongoose.connection;
  }

  private async createMongoIndexes(client: any, dbName: string) {
    const db = client.db(dbName);
    const checkpoints = db.collection(this.checkpointCollectionName());
    const writes = db.collection(this.checkpointWritesCollectionName());
    await Promise.all([
      checkpoints.createIndex(
        { thread_id: 1, checkpoint_ns: 1, checkpoint_id: -1 },
        { name: 'canvas_langgraph_thread_checkpoint' },
      ),
      writes.createIndex(
        { thread_id: 1, checkpoint_ns: 1, checkpoint_id: 1, task_id: 1, idx: 1 },
        { name: 'canvas_langgraph_thread_write', unique: true },
      ),
    ]);
    const ttlSeconds = this.checkpointTtlSeconds();
    if (ttlSeconds > 0) {
      await Promise.all([
        checkpoints.createIndex(
          { upserted_at: 1 },
          { name: 'canvas_langgraph_checkpoint_ttl', expireAfterSeconds: ttlSeconds },
        ),
        writes.createIndex(
          { upserted_at: 1 },
          { name: 'canvas_langgraph_write_ttl', expireAfterSeconds: ttlSeconds },
        ),
      ]);
    }
  }

  private async ensureMongoIndexes(client: any, dbName: string) {
    if (this.mongoIndexesReady) return await this.mongoIndexesReady;
    const indexesReady = (async () => {
      const maxAttempts = this.checkpointIndexRetryAttempts();
      const retryDelayMs = this.checkpointIndexRetryDelayMs();
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await this.createMongoIndexes(client, dbName);
          return;
        } catch (error) {
          if (attempt >= maxAttempts || !this.isTransientMongoError(error)) throw error;
          const delayMs = retryDelayMs * attempt;
          logEvent('warn', 'langgraph.checkpoint_indexes.retry', {
            attempt,
            maxAttempts,
            delayMs,
            error: getErrorDetails(error),
          });
          await this.wait(delayMs);
        }
      }
    })();
    this.mongoIndexesReady = indexesReady;
    try {
      return await indexesReady;
    } catch (error) {
      if (this.mongoIndexesReady === indexesReady) this.mongoIndexesReady = undefined;
      throw error;
    }
  }

  private async resolveCheckpointer(): Promise<{ saver: BaseCheckpointSaver; storage: 'mongodb' | 'memory'; durable: boolean }> {
    const connection = this.getMongoConnection();
    if (connection?.readyState !== 1 || !connection?.db) {
      return { saver: this.memorySaver, storage: 'memory', durable: false };
    }

    const client = connection.getClient();
    const dbName = connection.db.databaseName;
    if (!this.mongoSaver || this.mongoClient !== client) {
      this.mongoClient = client;
      this.mongoIndexesReady = undefined;
      this.mongoSaver = new MongoDBSaver({
        client: client as any,
        dbName,
        checkpointCollectionName: this.checkpointCollectionName(),
        checkpointWritesCollectionName: this.checkpointWritesCollectionName(),
        enableTimestamps: true,
      });
    }
    try {
      await this.ensureMongoIndexes(client, dbName);
    } catch (error) {
      logEvent('warn', 'langgraph.checkpoint_indexes.failed', {
        fallbackStorage: 'memory',
        error: getErrorDetails(error),
      });
      return { saver: this.memorySaver, storage: 'memory', durable: false };
    }
    return { saver: this.mongoSaver, storage: 'mongodb', durable: true };
  }

  async run(params: {
    threadId: string;
    initialState: CanvasFlowLangGraphState;
    executeTick: (state: CanvasFlowLangGraphState) => Promise<CanvasFlowLangGraphState>;
  }): Promise<{ state: CanvasFlowLangGraphState; runtime: CanvasFlowLangGraphRuntimeMetadata }> {
    const checkpointNamespace = this.checkpointNamespace();
    const checkpointer = await this.resolveCheckpointer();
    const graph = new StateGraph(RuntimeAnnotation)
      .addNode('advance_canvas_flow', async (state) => ({
        runtime: await params.executeTick(state.runtime),
      }))
      .addEdge(START, 'advance_canvas_flow')
      .addConditionalEdges(
        'advance_canvas_flow',
        (state) => state.runtime.status === 'running' ? 'advance_canvas_flow' : END,
      )
      .compile({ checkpointer: checkpointer.saver });
    const graphConfig = {
      configurable: {
        thread_id: params.threadId,
        checkpoint_ns: checkpointNamespace,
      },
      recursionLimit: Math.max(30, params.initialState.maxExecutionSteps + 10),
    };
    let startState = params.initialState;
    let recovered = false;

    const previous = await graph.getState(graphConfig).catch(() => null);
    const previousState = previous?.values?.runtime as CanvasFlowLangGraphState | undefined;
    if (previousState?.status === 'running' && previousState.runId === params.initialState.runId) {
      startState = previousState;
      recovered = true;
    }

    const result = await graph.invoke({ runtime: startState }, graphConfig);
    return {
      state: result.runtime,
      runtime: {
        engine: 'langgraph',
        durable: checkpointer.durable,
        storage: checkpointer.storage,
        threadId: params.threadId,
        checkpointNamespace,
        checkpoints: Number(result.runtime.checkpoints || 0),
        recovered,
        status: result.runtime.status,
      },
    };
  }
}
