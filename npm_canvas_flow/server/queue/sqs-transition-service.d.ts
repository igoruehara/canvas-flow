import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { QueueJobEntity } from './queue-job-schema';
import { QueueLockEntity } from './queue-lock-schema';
import { QueueRateLimitEntity } from './queue-rate-limit-schema';
import { QueueMessageDedupeEntity } from './queue-message-dedupe-schema';
export declare class SqsTransitionService {
    private readonly configService;
    private readonly jobModel;
    private readonly lockModel;
    private readonly rateLimitModel;
    private readonly messageDedupeModel;
    private readonly client;
    constructor(configService: ConfigService, jobModel: Model<QueueJobEntity>, lockModel: Model<QueueLockEntity>, rateLimitModel: Model<QueueRateLimitEntity>, messageDedupeModel: Model<QueueMessageDedupeEntity>);
    isEnabled(): boolean;
    private queueUrl;
    private jobTtlMs;
    private clampDelaySeconds;
    private getConversationId;
    private getMessageGroupId;
    private getConversationKey;
    private getJobMetadata;
    private cleanResult;
    enqueue(type: string, payload: any, options?: {
        trackResult?: boolean;
        delaySeconds?: number;
        jobId?: string;
        storePayloadInJob?: boolean;
    }): Promise<{
        queued: boolean;
        skipped: boolean;
        messageId?: undefined;
        id?: undefined;
        jobId?: undefined;
        type?: undefined;
        status?: undefined;
    } | {
        queued: boolean;
        messageId: string;
        id: string;
        jobId: string;
        type: string;
        status: string;
        skipped?: undefined;
    }>;
    markRunning(jobId?: string): Promise<void>;
    markCompleted(jobId: string | undefined, result: any): Promise<void>;
    markFailed(jobId: string | undefined, error: any): Promise<void>;
    getJob(jobId: string, organizationId?: string): Promise<any>;
    findJob(jobId?: string): Promise<import("mongoose").FlattenMaps<QueueJobEntity> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    acquireConversationLock(lockKey: string | undefined, ownerId: string, ttlMs: number): Promise<boolean>;
    releaseConversationLock(lockKey: string | undefined, ownerId: string): Promise<void>;
    isRateLimitEnabled(): boolean;
    getRateLimit(kind?: 'webwidget' | 'whatsapp' | 'api'): number;
    assertRateLimit(params: {
        scope: string;
        limit: number;
        windowMs?: number;
    }): Promise<{
        allowed: boolean;
        scope?: undefined;
        count?: undefined;
        limit?: undefined;
        windowMs?: undefined;
    } | {
        allowed: boolean;
        scope: string;
        count: number;
        limit: number;
        windowMs: number;
    }>;
    private dedupeTtlMs;
    tryStartMessageDedupe(params: {
        dedupeKey: string;
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        conversationId?: string;
        channel?: string;
        provider?: string;
        providerMessageId?: string;
    }): Promise<{
        acquired: boolean;
        status?: undefined;
        duplicate?: undefined;
    } | {
        acquired: boolean;
        status: string;
        duplicate?: undefined;
    } | {
        acquired: boolean;
        duplicate: boolean;
        status: string;
    }>;
    completeMessageDedupe(dedupeKey?: string): Promise<void>;
    failMessageDedupe(dedupeKey: string | undefined, error: any): Promise<void>;
    getQueueHealth(): Promise<any>;
    retryJob(jobId: string, organizationId?: string): Promise<{
        queued: boolean;
        skipped: boolean;
        messageId?: undefined;
        id?: undefined;
        jobId?: undefined;
        type?: undefined;
        status?: undefined;
    } | {
        queued: boolean;
        messageId: string;
        id: string;
        jobId: string;
        type: string;
        status: string;
        skipped?: undefined;
    } | {
        skipped: boolean;
        reason: string;
        jobId: string;
    }>;
}
