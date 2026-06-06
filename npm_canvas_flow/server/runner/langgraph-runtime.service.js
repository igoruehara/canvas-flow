"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangGraphRuntimeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const langgraph_1 = require("@langchain/langgraph");
const langgraph_checkpoint_mongodb_1 = require("@langchain/langgraph-checkpoint-mongodb");
const crypto_1 = require("crypto");
const mongoose = require("mongoose");
const constants_global_1 = require("../constants-global");
const observability_1 = require("../observability/observability");
const RuntimeAnnotation = langgraph_1.Annotation.Root({
    runtime: (0, langgraph_1.Annotation)(),
});
let LangGraphRuntimeService = class LangGraphRuntimeService {
    constructor(databaseConnection, configService) {
        this.databaseConnection = databaseConnection;
        this.configService = configService;
        this.memorySaver = new langgraph_1.MemorySaver();
    }
    createThreadId(scope) {
        const digest = (0, crypto_1.createHash)('sha256')
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
    checkpointNamespace() {
        return String(this.configService?.get('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_NAMESPACE') || 'canvas-flow-runtime-v1');
    }
    checkpointCollectionName() {
        return String(this.configService?.get('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_COLLECTION') || 'canvas_langgraph_checkpoints');
    }
    checkpointWritesCollectionName() {
        return String(this.configService?.get('CANVAS_FLOW_LANGGRAPH_WRITES_COLLECTION') || 'canvas_langgraph_checkpoint_writes');
    }
    checkpointTtlSeconds() {
        const hours = Number(this.configService?.get('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_TTL_HOURS') || 720);
        if (!Number.isFinite(hours) || hours <= 0)
            return 0;
        return Math.max(3600, Math.floor(hours * 60 * 60));
    }
    checkpointIndexRetryAttempts() {
        const attempts = Number(this.configService?.get('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_ATTEMPTS') || 3);
        if (!Number.isFinite(attempts))
            return 3;
        return Math.max(1, Math.min(10, Math.floor(attempts)));
    }
    checkpointIndexRetryDelayMs() {
        const delayMs = Number(this.configService?.get('CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_DELAY_MS') || 250);
        if (!Number.isFinite(delayMs))
            return 250;
        return Math.max(0, Math.min(5000, Math.floor(delayMs)));
    }
    isTransientMongoError(error) {
        const name = String(error?.name || '');
        const message = String(error?.message || '');
        return [
            'MongoNetworkError',
            'MongoNetworkTimeoutError',
            'MongoServerSelectionError',
            'MongoTopologyClosedError',
        ].includes(name) || /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|connection.*closed|socket/i.test(message);
    }
    async wait(delayMs) {
        if (delayMs <= 0)
            return;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    getMongoConnection() {
        return this.databaseConnection?.connection || mongoose.connection;
    }
    async createMongoIndexes(client, dbName) {
        const db = client.db(dbName);
        const checkpoints = db.collection(this.checkpointCollectionName());
        const writes = db.collection(this.checkpointWritesCollectionName());
        await Promise.all([
            checkpoints.createIndex({ thread_id: 1, checkpoint_ns: 1, checkpoint_id: -1 }, { name: 'canvas_langgraph_thread_checkpoint' }),
            writes.createIndex({ thread_id: 1, checkpoint_ns: 1, checkpoint_id: 1, task_id: 1, idx: 1 }, { name: 'canvas_langgraph_thread_write', unique: true }),
        ]);
        const ttlSeconds = this.checkpointTtlSeconds();
        if (ttlSeconds > 0) {
            await Promise.all([
                checkpoints.createIndex({ upserted_at: 1 }, { name: 'canvas_langgraph_checkpoint_ttl', expireAfterSeconds: ttlSeconds }),
                writes.createIndex({ upserted_at: 1 }, { name: 'canvas_langgraph_write_ttl', expireAfterSeconds: ttlSeconds }),
            ]);
        }
    }
    async ensureMongoIndexes(client, dbName) {
        if (this.mongoIndexesReady)
            return await this.mongoIndexesReady;
        const indexesReady = (async () => {
            const maxAttempts = this.checkpointIndexRetryAttempts();
            const retryDelayMs = this.checkpointIndexRetryDelayMs();
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                try {
                    await this.createMongoIndexes(client, dbName);
                    return;
                }
                catch (error) {
                    if (attempt >= maxAttempts || !this.isTransientMongoError(error))
                        throw error;
                    const delayMs = retryDelayMs * attempt;
                    (0, observability_1.logEvent)('warn', 'langgraph.checkpoint_indexes.retry', {
                        attempt,
                        maxAttempts,
                        delayMs,
                        error: (0, observability_1.getErrorDetails)(error),
                    });
                    await this.wait(delayMs);
                }
            }
        })();
        this.mongoIndexesReady = indexesReady;
        try {
            return await indexesReady;
        }
        catch (error) {
            if (this.mongoIndexesReady === indexesReady)
                this.mongoIndexesReady = undefined;
            throw error;
        }
    }
    async resolveCheckpointer() {
        const connection = this.getMongoConnection();
        if (connection?.readyState !== 1 || !connection?.db) {
            return { saver: this.memorySaver, storage: 'memory', durable: false };
        }
        const client = connection.getClient();
        const dbName = connection.db.databaseName;
        if (!this.mongoSaver || this.mongoClient !== client) {
            this.mongoClient = client;
            this.mongoIndexesReady = undefined;
            this.mongoSaver = new langgraph_checkpoint_mongodb_1.MongoDBSaver({
                client: client,
                dbName,
                checkpointCollectionName: this.checkpointCollectionName(),
                checkpointWritesCollectionName: this.checkpointWritesCollectionName(),
                enableTimestamps: true,
            });
        }
        try {
            await this.ensureMongoIndexes(client, dbName);
        }
        catch (error) {
            (0, observability_1.logEvent)('warn', 'langgraph.checkpoint_indexes.failed', {
                fallbackStorage: 'memory',
                error: (0, observability_1.getErrorDetails)(error),
            });
            return { saver: this.memorySaver, storage: 'memory', durable: false };
        }
        return { saver: this.mongoSaver, storage: 'mongodb', durable: true };
    }
    async run(params) {
        const checkpointNamespace = this.checkpointNamespace();
        const checkpointer = await this.resolveCheckpointer();
        const graph = new langgraph_1.StateGraph(RuntimeAnnotation)
            .addNode('advance_canvas_flow', async (state) => ({
            runtime: await params.executeTick(state.runtime),
        }))
            .addEdge(langgraph_1.START, 'advance_canvas_flow')
            .addConditionalEdges('advance_canvas_flow', (state) => state.runtime.status === 'running' ? 'advance_canvas_flow' : langgraph_1.END)
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
        const previousState = previous?.values?.runtime;
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
};
exports.LangGraphRuntimeService = LangGraphRuntimeService;
exports.LangGraphRuntimeService = LangGraphRuntimeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(constants_global_1.STRING_URL_DATABASE_CONNECTION)),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], LangGraphRuntimeService);
//# sourceMappingURL=langgraph-runtime.service.js.map