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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunnerQueueProcessor = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const observability_1 = require("../observability/observability");
const sqs_transition_service_1 = require("../queue/sqs-transition-service");
const runner_service_1 = require("./runner-service");
class ConversationLockedError extends Error {
    constructor(lockKey) {
        super(`Conversa em processamento: ${lockKey}`);
        this.retryable = true;
    }
}
let RunnerQueueProcessor = class RunnerQueueProcessor {
    constructor(runnerService, sqsTransitionService, configService) {
        this.runnerService = runnerService;
        this.sqsTransitionService = sqsTransitionService;
        this.configService = configService;
    }
    getErrorMessage(error) {
        return error?.message || String(error || 'Falha ao processar mensagem SQS.');
    }
    parseRecord(record) {
        if (!record?.body)
            return record;
        return typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    }
    getItemIdentifier(record, index) {
        return String(record?.messageId || record?.messageID || record?.id || `record-${index}`);
    }
    getRecordGroupId(record, index) {
        const raw = (() => {
            try {
                return this.parseRecord(record);
            }
            catch {
                return undefined;
            }
        })();
        return String(raw?.conversationKey ||
            record?.attributes?.MessageGroupId ||
            record?.attributes?.messageGroupId ||
            record?.messageAttributes?.MessageGroupId?.stringValue ||
            record?.messageAttributes?.messageGroupId?.stringValue ||
            this.getItemIdentifier(record, index));
    }
    consumerConcurrency() {
        return Math.max(1, Math.min(50, Math.floor(Number(this.configService.get('CANVAS_FLOW_SQS_CONSUMER_CONCURRENCY') || 10))));
    }
    lockTtlMs() {
        return Math.max(10000, Math.floor(Number(this.configService.get('CANVAS_FLOW_SQS_CONVERSATION_LOCK_TTL_MS') || 900000)));
    }
    getJobId(raw) {
        return String(raw?.id || raw?.payload?.jobId || '').trim();
    }
    async resolvePayload(raw, jobId) {
        if (raw?.payloadRef !== 'job')
            return raw?.payload || {};
        const job = await this.sqsTransitionService.findJob(jobId);
        if (!job) {
            throw new Error(`Payload do job SQS ${jobId || '<sem id>'} nao encontrado.`);
        }
        const payload = job.payload;
        if (!payload || typeof payload !== 'object') {
            throw new Error(`Payload do job SQS ${jobId} nao esta mais disponivel.`);
        }
        return payload;
    }
    getPayloadConversationId(payload) {
        const body = payload?.body || {};
        return String(payload?.conversationId ||
            body?.conversationId ||
            body?.conversation?.id ||
            body?.contact?.id ||
            body?.message?.from ||
            body?.resource?.from ||
            body?.from ||
            body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
            body?.message_inbound?.channel_identity?.identity ||
            body?.messageInbound?.channel_identity?.identity ||
            body?.event?.message_inbound?.channel_identity?.identity ||
            body?.message_inbound?.contact_id ||
            body?.messageInbound?.contact_id ||
            '');
    }
    buildConversationLockKey(type, payload) {
        const organizationId = String(payload?._organizationId || payload?.organizationId || '').trim();
        const agentId = String(payload?.agentId || '').trim();
        const flowId = String(payload?.flowId || '').trim();
        const conversationId = this.getPayloadConversationId(payload);
        return [
            organizationId || 'global',
            agentId || 'default-agent',
            conversationId || flowId || type || 'canvas-flow',
        ].join(':');
    }
    async dispatch(type, payload) {
        if (type === 'canvas-flow.whatsapp') {
            return await this.runnerService.runWhatsappWebhook(payload.flowId, { ...(payload.body || {}), skipQueue: true });
        }
        if (type === 'canvas-flow.whatsapp-main') {
            return await this.runnerService.runWhatsappMainWebhook(payload.agentId, { ...(payload.body || {}), skipQueue: true });
        }
        return await this.runnerService.run({ ...payload, skipQueue: true });
    }
    async processEnvelope(raw) {
        const type = String(raw?.type || 'canvas-flow.run');
        const jobId = this.getJobId(raw);
        const trackResult = raw?.trackResult === true;
        const ownerId = `${jobId || raw?.id || 'sqs'}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        let lockKey = String(raw?.conversationKey || '').trim();
        let lockAcquired = false;
        let payload;
        if (trackResult && jobId) {
            const existingJob = await this.sqsTransitionService.findJob(jobId);
            if (existingJob?.status === 'completed') {
                return existingJob.result || { ok: true, skipped: true, jobId, status: 'completed' };
            }
        }
        try {
            payload = await this.resolvePayload(raw, jobId);
            if (!lockKey) {
                lockKey = this.buildConversationLockKey(type, payload);
            }
            lockAcquired = await this.sqsTransitionService.acquireConversationLock(lockKey, ownerId, this.lockTtlMs());
            if (!lockAcquired) {
                throw new ConversationLockedError(lockKey);
            }
            if (trackResult && jobId) {
                await this.sqsTransitionService.markRunning(jobId);
            }
            const startedAt = Date.now();
            (0, observability_1.logEvent)('info', 'queue.message.started', {
                type,
                jobId,
                lockKey,
                conversationId: this.getPayloadConversationId(payload),
                agentId: payload?.agentId,
                flowId: payload?.flowId,
            });
            const result = await this.dispatch(type, payload);
            if (trackResult) {
                await this.sqsTransitionService.markCompleted(jobId, result);
            }
            if (payload?._webhookAsync) {
                await this.runnerService.persistWebhookRunState(payload, result).catch((error) => {
                    (0, observability_1.logEvent)('warn', 'queue.webhook_state.failed', {
                        jobId,
                        error: (0, observability_1.getErrorDetails)(error),
                    });
                });
            }
            if (payload?._webhookAsync) {
                await this.runnerService.deliverWebhookCallback(payload._webhookAsync, result).catch((error) => {
                    (0, observability_1.logEvent)('warn', 'queue.webhook_callback.failed', {
                        jobId,
                        error: (0, observability_1.getErrorDetails)(error),
                    });
                });
            }
            (0, observability_1.logEvent)('info', 'queue.message.completed', {
                type,
                jobId,
                lockKey,
                durationMs: Date.now() - startedAt,
                status: result?.ended ? 'ended' : 'ok',
            });
            return result;
        }
        catch (error) {
            if (trackResult && !error?.retryable) {
                await this.sqsTransitionService.markFailed(jobId, error);
            }
            if (payload?._webhookAsync && !error?.retryable) {
                await this.runnerService.deliverWebhookCallback(payload._webhookAsync, undefined, error).catch(() => undefined);
            }
            (0, observability_1.logEvent)(error?.retryable ? 'warn' : 'error', 'queue.message.failed', {
                type,
                jobId,
                lockKey,
                retryable: Boolean(error?.retryable),
                error: (0, observability_1.getErrorDetails)(error),
            });
            throw error;
        }
        finally {
            if (lockAcquired) {
                await this.sqsTransitionService.releaseConversationLock(lockKey, ownerId).catch(() => undefined);
            }
        }
    }
    async processRecord(record) {
        return await this.processEnvelope(this.parseRecord(record));
    }
    async processRecords(records) {
        const results = [];
        const failures = [];
        const batchItemFailures = [];
        const groups = new Map();
        for (let index = 0; index < records.length; index += 1) {
            const groupId = this.getRecordGroupId(records[index], index);
            const group = groups.get(groupId) || [];
            group.push({ record: records[index], index });
            groups.set(groupId, group);
        }
        const groupedRecords = Array.from(groups.values());
        let nextGroupIndex = 0;
        const workerCount = Math.min(this.consumerConcurrency(), groupedRecords.length || 1);
        const processOne = async (record, index) => {
            try {
                results.push(await this.processRecord(record));
            }
            catch (error) {
                const itemIdentifier = this.getItemIdentifier(record, index);
                const failure = {
                    itemIdentifier,
                    error: this.getErrorMessage(error),
                };
                failures.push(failure);
                batchItemFailures.push({ itemIdentifier });
                results.push({ ok: false, error: failure.error });
            }
        };
        await Promise.all(Array.from({ length: workerCount }, async () => {
            while (nextGroupIndex < groupedRecords.length) {
                const group = groupedRecords[nextGroupIndex];
                nextGroupIndex += 1;
                for (const item of group) {
                    await processOne(item.record, item.index);
                }
            }
        }));
        return {
            consumed: results.length - failures.length,
            failed: failures.length,
            failures,
            batchItemFailures,
            results,
        };
    }
};
exports.RunnerQueueProcessor = RunnerQueueProcessor;
exports.RunnerQueueProcessor = RunnerQueueProcessor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [runner_service_1.RunnerService,
        sqs_transition_service_1.SqsTransitionService,
        config_1.ConfigService])
], RunnerQueueProcessor);
//# sourceMappingURL=runner-queue-processor.js.map