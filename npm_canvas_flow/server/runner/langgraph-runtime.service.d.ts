import { ConfigService } from '@nestjs/config';
import * as mongoose from 'mongoose';
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
export declare class LangGraphRuntimeService {
    private readonly databaseConnection?;
    private readonly configService?;
    private readonly memorySaver;
    private mongoSaver?;
    private mongoClient?;
    private mongoIndexesReady?;
    constructor(databaseConnection?: typeof mongoose, configService?: ConfigService);
    createThreadId(scope: CanvasFlowLangGraphThreadScope): string;
    private checkpointNamespace;
    private checkpointCollectionName;
    private checkpointWritesCollectionName;
    private checkpointTtlSeconds;
    private checkpointIndexRetryAttempts;
    private checkpointIndexRetryDelayMs;
    private isTransientMongoError;
    private wait;
    private getMongoConnection;
    private createMongoIndexes;
    private ensureMongoIndexes;
    private resolveCheckpointer;
    run(params: {
        threadId: string;
        initialState: CanvasFlowLangGraphState;
        executeTick: (state: CanvasFlowLangGraphState) => Promise<CanvasFlowLangGraphState>;
    }): Promise<{
        state: CanvasFlowLangGraphState;
        runtime: CanvasFlowLangGraphRuntimeMetadata;
    }>;
}
