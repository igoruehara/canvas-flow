import { ConfigService } from '@nestjs/config';
import { SqsTransitionService } from '../queue/sqs-transition-service';
import { RunnerService } from './runner-service';
export declare class RunnerQueueProcessor {
    private readonly runnerService;
    private readonly sqsTransitionService;
    private readonly configService;
    constructor(runnerService: RunnerService, sqsTransitionService: SqsTransitionService, configService: ConfigService);
    private getErrorMessage;
    private parseRecord;
    private getItemIdentifier;
    private getRecordGroupId;
    private consumerConcurrency;
    private lockTtlMs;
    private getJobId;
    private resolvePayload;
    private getPayloadConversationId;
    private buildConversationLockKey;
    private dispatch;
    processEnvelope(raw: any): Promise<any>;
    processRecord(record: any): Promise<any>;
    processRecords(records: any[]): Promise<{
        consumed: number;
        failed: number;
        failures: any[];
        batchItemFailures: any[];
        results: any[];
    }>;
}
