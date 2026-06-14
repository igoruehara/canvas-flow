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
exports.SqsTransitionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_sqs_1 = require("@aws-sdk/client-sqs");
const crypto_1 = require("crypto");
const mongoose_1 = require("mongoose");
const queue_job_constants_model_1 = require("./queue-job-constants-model");
const queue_lock_constants_model_1 = require("./queue-lock-constants-model");
const queue_rate_limit_constants_model_1 = require("./queue-rate-limit-constants-model");
const queue_message_dedupe_constants_model_1 = require("./queue-message-dedupe-constants-model");
const observability_1 = require("../observability/observability");
let SqsTransitionService = class SqsTransitionService {
    constructor(configService, jobModel, lockModel, rateLimitModel, messageDedupeModel) {
        this.configService = configService;
        this.jobModel = jobModel;
        this.lockModel = lockModel;
        this.rateLimitModel = rateLimitModel;
        this.messageDedupeModel = messageDedupeModel;
        this.client = new client_sqs_1.SQSClient({
            region: this.configService.get('AWS_REGION') || this.configService.get('CANVAS_FLOW_SQS_REGION') || 'us-east-1',
        });
    }
    isEnabled() {
        return ['true', '1', 'yes', 'sim'].includes(String(this.configService.get('CANVAS_FLOW_SQS') || '').toLowerCase());
    }
    queueUrl() {
        return this.configService.get('CANVAS_FLOW_SQS_QUEUE_URL') || this.configService.get('SQS_QUEUE_URL') || '';
    }
    jobTtlMs() {
        const hours = Math.max(1, Number(this.configService.get('CANVAS_FLOW_SQS_JOB_TTL_HOURS') || 24));
        return hours * 60 * 60 * 1000;
    }
    clampDelaySeconds(value) {
        return Math.max(0, Math.min(900, Math.floor(Number(value || 0))));
    }
    getConversationId(payload) {
        const body = payload?.body || {};
        return String(payload?.conversationId ||
            body?.conversationId ||
            body?.conversation?.id ||
            body?.contact?.id ||
            body?.message?.from ||
            body?.resource?.from ||
            body?.from ||
            body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
            body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.to ||
            body?.entry?.[0]?.changes?.[0]?.value?.message_echoes?.[0]?.to ||
            body?.entry?.[0]?.changes?.[0]?.value?.smb_message_echoes?.[0]?.to ||
            body?.message_inbound?.channel_identity?.identity ||
            body?.messageInbound?.channel_identity?.identity ||
            body?.event?.message_inbound?.channel_identity?.identity ||
            body?.message_inbound?.contact_id ||
            body?.messageInbound?.contact_id ||
            '');
    }
    getMessageGroupId(type, payload) {
        const conversationId = this.getConversationId(payload);
        return String(conversationId ||
            payload?.conversationId ||
            payload?.body?.conversationId ||
            payload?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
            payload?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.to ||
            payload?.body?.entry?.[0]?.changes?.[0]?.value?.message_echoes?.[0]?.to ||
            payload?.body?.entry?.[0]?.changes?.[0]?.value?.smb_message_echoes?.[0]?.to ||
            payload?.flowId ||
            payload?.agentId ||
            type ||
            'canvas-flow');
    }
    getConversationKey(type, payload) {
        const organizationId = String(payload?._organizationId || payload?.organizationId || '').trim();
        const agentId = String(payload?.agentId || '').trim();
        const flowId = String(payload?.flowId || '').trim();
        const conversationId = this.getConversationId(payload);
        return [
            organizationId || 'global',
            agentId || 'default-agent',
            conversationId || flowId || type || 'canvas-flow',
        ].join(':');
    }
    getJobMetadata(type, payload) {
        return {
            organizationId: payload?._organizationId,
            agentId: payload?.agentId,
            flowId: payload?.flowId,
            conversationId: this.getConversationId(payload),
            metadata: {
                channel: payload?.channel,
                async: payload?.async === true,
                queue: payload?.queue === true,
                type,
            },
        };
    }
    cleanResult(result) {
        if (!result || typeof result !== 'object')
            return result;
        return (0, observability_1.sanitizeForLog)({
            ...result,
            trace: Array.isArray(result.trace) ? result.trace.slice(-100) : result.trace,
        });
    }
    async enqueue(type, payload, options) {
        if (!this.isEnabled())
            return { queued: false, skipped: true };
        const queueUrl = this.queueUrl();
        if (!queueUrl) {
            throw new Error('CANVAS_FLOW_SQS_QUEUE_URL precisa estar configurado quando CANVAS_FLOW_SQS=true.');
        }
        const jobId = options?.jobId || (0, crypto_1.randomUUID)();
        const storePayloadInJob = options?.storePayloadInJob !== false && options?.trackResult === true;
        const body = {
            id: jobId,
            type,
            conversationKey: this.getConversationKey(type, payload),
            payload: storePayloadInJob ? { jobId } : payload,
            payloadRef: storePayloadInJob ? 'job' : undefined,
            trackResult: options?.trackResult === true,
            createdAt: new Date().toISOString(),
        };
        if (options?.trackResult) {
            const metadata = this.getJobMetadata(type, payload);
            await this.jobModel
                .findOneAndUpdate({ jobId }, {
                $set: {
                    jobId,
                    type,
                    status: 'queued',
                    ...metadata,
                    ...(storePayloadInJob ? { payload } : {}),
                    error: undefined,
                    result: undefined,
                    queuedAt: new Date(),
                    expiresAt: new Date(Date.now() + this.jobTtlMs()),
                },
            }, { upsert: true, new: true, setDefaultsOnInsert: true })
                .lean()
                .exec();
        }
        const delaySeconds = this.clampDelaySeconds(options?.delaySeconds);
        const response = await this.client.send(new client_sqs_1.SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(body),
            ...(delaySeconds > 0 ? { DelaySeconds: delaySeconds } : {}),
            ...(queueUrl.endsWith('.fifo') ? {
                MessageGroupId: this.getMessageGroupId(type, payload),
                MessageDeduplicationId: body.id,
            } : {}),
        }));
        if (options?.trackResult && response.MessageId) {
            await this.jobModel.updateOne({ jobId }, { $set: { messageId: response.MessageId } }).exec();
        }
        return {
            queued: true,
            messageId: response.MessageId,
            id: body.id,
            jobId: body.id,
            type,
            status: options?.trackResult ? 'queued' : undefined,
        };
    }
    async markRunning(jobId) {
        if (!jobId)
            return;
        await this.jobModel
            .updateOne({ jobId }, {
            $set: {
                status: 'running',
                startedAt: new Date(),
                expiresAt: new Date(Date.now() + this.jobTtlMs()),
            },
        })
            .exec();
    }
    async markCompleted(jobId, result) {
        if (!jobId)
            return;
        await this.jobModel
            .updateOne({ jobId }, {
            $set: {
                status: 'completed',
                result: this.cleanResult(result),
                completedAt: new Date(),
                expiresAt: new Date(Date.now() + this.jobTtlMs()),
            },
            $unset: { error: '', payload: '' },
        })
            .exec();
    }
    async markFailed(jobId, error) {
        if (!jobId)
            return;
        const message = error instanceof Error ? error.message : String(error || 'Falha ao processar job SQS.');
        await this.jobModel
            .updateOne({ jobId }, {
            $set: {
                status: 'failed',
                error: message,
                failedAt: new Date(),
                expiresAt: new Date(Date.now() + this.jobTtlMs()),
            },
        })
            .exec();
    }
    async getJob(jobId, organizationId) {
        const query = { jobId };
        if (organizationId)
            query.organizationId = organizationId;
        const job = await this.jobModel.findOne(query).lean().exec();
        if (!job)
            throw new common_1.NotFoundException('Job SQS não encontrado.');
        const { payload, __v, ...safeJob } = job;
        return safeJob;
    }
    async findJob(jobId) {
        if (!jobId)
            return null;
        return await this.jobModel.findOne({ jobId }).lean().exec();
    }
    async acquireConversationLock(lockKey, ownerId, ttlMs) {
        if (!lockKey)
            return true;
        const now = new Date();
        const expiresAt = new Date(Date.now() + Math.max(1000, ttlMs));
        try {
            const lock = await this.lockModel
                .findOneAndUpdate({
                lockKey,
                $or: [
                    { expiresAt: { $lte: now } },
                    { ownerId },
                ],
            }, {
                $set: {
                    lockKey,
                    ownerId,
                    expiresAt,
                },
                $setOnInsert: {
                    createdAt: now,
                },
            }, { upsert: true, new: true, setDefaultsOnInsert: true })
                .lean()
                .exec();
            return Boolean(lock && lock.ownerId === ownerId);
        }
        catch (error) {
            if (error?.code === 11000)
                return false;
            throw error;
        }
    }
    async releaseConversationLock(lockKey, ownerId) {
        if (!lockKey)
            return;
        await this.lockModel.deleteOne({ lockKey, ownerId }).exec();
    }
    isRateLimitEnabled() {
        return !['false', '0', 'no', 'nao'].includes(String(this.configService.get('CANVAS_FLOW_RATE_LIMIT_ENABLED') || 'true').toLowerCase());
    }
    getRateLimit(kind = 'api') {
        const fallback = Number(this.configService.get('CANVAS_FLOW_RATE_LIMIT_PER_MINUTE') || 600);
        const value = kind === 'webwidget'
            ? this.configService.get('CANVAS_FLOW_RATE_LIMIT_WEBWIDGET_PER_MINUTE')
            : kind === 'whatsapp'
                ? this.configService.get('CANVAS_FLOW_RATE_LIMIT_WHATSAPP_PER_MINUTE')
                : this.configService.get('CANVAS_FLOW_RATE_LIMIT_API_PER_MINUTE');
        return Math.max(1, Math.floor(Number(value || fallback)));
    }
    async assertRateLimit(params) {
        if (!this.isRateLimitEnabled())
            return { allowed: true };
        const scope = String(params.scope || '').trim();
        const limit = Math.max(1, Math.floor(Number(params.limit || 0)));
        const windowMs = Math.max(1000, Math.floor(Number(params.windowMs || this.configService.get('CANVAS_FLOW_RATE_LIMIT_WINDOW_MS') || 60000)));
        if (!scope || !limit)
            return { allowed: true };
        const now = Date.now();
        const windowStartedAt = new Date(Math.floor(now / windowMs) * windowMs);
        const expiresAt = new Date(windowStartedAt.getTime() + windowMs + 30000);
        const bucketKey = `${scope}:${windowStartedAt.getTime()}`;
        const bucket = await this.rateLimitModel
            .findOneAndUpdate({ bucketKey }, {
            $inc: { count: 1 },
            $set: { limit, windowStartedAt, expiresAt },
        }, { upsert: true, new: true, setDefaultsOnInsert: true })
            .lean()
            .exec();
        if (Number(bucket?.count || 0) > limit) {
            throw new common_1.HttpException({
                message: 'Rate limit excedido.',
                scope,
                limit,
                windowMs,
                retryAfterMs: Math.max(0, windowStartedAt.getTime() + windowMs - now),
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        return {
            allowed: true,
            scope,
            count: Number(bucket?.count || 0),
            limit,
            windowMs,
        };
    }
    dedupeTtlMs() {
        const hours = Math.max(1, Number(this.configService.get('CANVAS_FLOW_MESSAGE_DEDUPE_TTL_HOURS') || 24));
        return hours * 60 * 60 * 1000;
    }
    async tryStartMessageDedupe(params) {
        const dedupeKey = String(params.dedupeKey || '').trim();
        if (!dedupeKey)
            return { acquired: true };
        const now = new Date();
        const expiresAt = new Date(Date.now() + this.dedupeTtlMs());
        const payload = {
            ...params,
            dedupeKey,
            status: 'processing',
            startedAt: now,
            expiresAt,
        };
        try {
            await new this.messageDedupeModel(payload).save();
            return { acquired: true, status: 'processing' };
        }
        catch (error) {
            if (error?.code !== 11000)
                throw error;
        }
        const existing = await this.messageDedupeModel.findOne({ dedupeKey }).lean().exec();
        if (existing?.status === 'completed') {
            return { acquired: false, duplicate: true, status: 'completed' };
        }
        if (existing?.status === 'processing' && existing.expiresAt && new Date(existing.expiresAt).getTime() > Date.now()) {
            return { acquired: false, duplicate: true, status: 'processing' };
        }
        const updated = await this.messageDedupeModel
            .findOneAndUpdate({
            dedupeKey,
            $or: [
                { status: 'failed' },
                { expiresAt: { $lte: now } },
            ],
        }, {
            $set: payload,
            $inc: { attempts: 1 },
        }, { new: true })
            .lean()
            .exec();
        return updated ? { acquired: true, status: 'processing' } : { acquired: false, duplicate: true, status: existing?.status || 'processing' };
    }
    async completeMessageDedupe(dedupeKey) {
        if (!dedupeKey)
            return;
        await this.messageDedupeModel
            .updateOne({ dedupeKey }, {
            $set: {
                status: 'completed',
                completedAt: new Date(),
                expiresAt: new Date(Date.now() + this.dedupeTtlMs()),
            },
            $unset: { error: '' },
        })
            .exec();
    }
    async failMessageDedupe(dedupeKey, error) {
        if (!dedupeKey)
            return;
        const message = error instanceof Error ? error.message : String(error || 'Falha ao processar mensagem.');
        await this.messageDedupeModel
            .updateOne({ dedupeKey }, {
            $set: {
                status: 'failed',
                error: message,
                failedAt: new Date(),
                expiresAt: new Date(Date.now() + this.dedupeTtlMs()),
            },
        })
            .exec();
    }
    async getQueueHealth() {
        const now = new Date();
        const [jobs, activeLocks, recentLimits, dedupe] = await Promise.all([
            this.jobModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
            this.lockModel.countDocuments({ expiresAt: { $gt: now } }).exec(),
            this.rateLimitModel.find({ expiresAt: { $gt: now } }).sort({ count: -1 }).limit(20).lean().exec(),
            this.messageDedupeModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
        ]);
        const byStatus = (rows) => rows.reduce((acc, row) => ({ ...acc, [row._id || 'unknown']: row.count }), {});
        return (0, observability_1.sanitizeForLog)({
            sqsEnabled: this.isEnabled(),
            queueConfigured: Boolean(this.queueUrl()),
            jobs: byStatus(jobs),
            dedupe: byStatus(dedupe),
            activeLocks,
            topRateLimitBuckets: recentLimits,
            generatedAt: new Date().toISOString(),
        });
    }
    async retryJob(jobId, organizationId) {
        const query = { jobId };
        if (organizationId)
            query.organizationId = organizationId;
        const job = await this.jobModel.findOne(query).lean().exec();
        if (!job)
            throw new common_1.NotFoundException('Job SQS nao encontrado.');
        if (!job.payload || typeof job.payload !== 'object') {
            throw new Error('Job nao possui payload disponivel para retry.');
        }
        if (job.status === 'completed') {
            return { skipped: true, reason: 'job_already_completed', jobId };
        }
        return await this.enqueue(job.type || 'canvas-flow.run', job.payload, {
            trackResult: true,
            jobId,
            storePayloadInJob: true,
        });
    }
};
exports.SqsTransitionService = SqsTransitionService;
exports.SqsTransitionService = SqsTransitionService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(queue_job_constants_model_1.MODEL_NAME)),
    __param(2, (0, common_1.Inject)(queue_lock_constants_model_1.MODEL_NAME)),
    __param(3, (0, common_1.Inject)(queue_rate_limit_constants_model_1.MODEL_NAME)),
    __param(4, (0, common_1.Inject)(queue_message_dedupe_constants_model_1.MODEL_NAME)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        mongoose_1.Model,
        mongoose_1.Model,
        mongoose_1.Model,
        mongoose_1.Model])
], SqsTransitionService);
//# sourceMappingURL=sqs-transition-service.js.map