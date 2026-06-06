import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorDetails, logEvent } from '../observability/observability';
import { SqsTransitionService } from '../queue/sqs-transition-service';
import { RunnerService } from './runner-service';

class ConversationLockedError extends Error {
  readonly retryable = true;

  constructor(lockKey: string) {
    super(`Conversa em processamento: ${lockKey}`);
  }
}

@Injectable()
export class RunnerQueueProcessor {
  constructor(
    private readonly runnerService: RunnerService,
    private readonly sqsTransitionService: SqsTransitionService,
    private readonly configService: ConfigService,
  ) {}

  private getErrorMessage(error: any) {
    return error?.message || String(error || 'Falha ao processar mensagem SQS.');
  }

  private parseRecord(record: any) {
    if (!record?.body) return record;
    return typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
  }

  private getItemIdentifier(record: any, index: number) {
    return String(record?.messageId || record?.messageID || record?.id || `record-${index}`);
  }

  private getRecordGroupId(record: any, index: number) {
    const raw = (() => {
      try {
        return this.parseRecord(record);
      } catch {
        return undefined;
      }
    })();
    return String(
      raw?.conversationKey ||
      record?.attributes?.MessageGroupId ||
      record?.attributes?.messageGroupId ||
      record?.messageAttributes?.MessageGroupId?.stringValue ||
      record?.messageAttributes?.messageGroupId?.stringValue ||
      this.getItemIdentifier(record, index),
    );
  }

  private consumerConcurrency() {
    return Math.max(1, Math.min(50, Math.floor(Number(this.configService.get<string>('CANVAS_FLOW_SQS_CONSUMER_CONCURRENCY') || 10))));
  }

  private lockTtlMs() {
    return Math.max(10000, Math.floor(Number(this.configService.get<string>('CANVAS_FLOW_SQS_CONVERSATION_LOCK_TTL_MS') || 900000)));
  }

  private getJobId(raw: any) {
    return String(raw?.id || raw?.payload?.jobId || '').trim();
  }

  private async resolvePayload(raw: any, jobId: string) {
    if (raw?.payloadRef !== 'job') return raw?.payload || {};

    const job = await this.sqsTransitionService.findJob(jobId);
    if (!job) {
      throw new Error(`Payload do job SQS ${jobId || '<sem id>'} nao encontrado.`);
    }
    const payload = (job as any).payload;
    if (!payload || typeof payload !== 'object') {
      throw new Error(`Payload do job SQS ${jobId} nao esta mais disponivel.`);
    }
    return payload;
  }

  private getPayloadConversationId(payload: any) {
    const body = payload?.body || {};
    return String(
      payload?.conversationId ||
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
      '',
    );
  }

  private buildConversationLockKey(type: string, payload: any) {
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

  private async dispatch(type: string, payload: any) {
    if (type === 'canvas-flow.whatsapp') {
      return await this.runnerService.runWhatsappWebhook(payload.flowId, { ...(payload.body || {}), skipQueue: true });
    }
    if (type === 'canvas-flow.whatsapp-main') {
      return await this.runnerService.runWhatsappMainWebhook(payload.agentId, { ...(payload.body || {}), skipQueue: true });
    }
    return await this.runnerService.run({ ...payload, skipQueue: true });
  }

  async processEnvelope(raw: any) {
    const type = String(raw?.type || 'canvas-flow.run');
    const jobId = this.getJobId(raw);
    const trackResult = raw?.trackResult === true;
    const ownerId = `${jobId || raw?.id || 'sqs'}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    let lockKey = String(raw?.conversationKey || '').trim();
    let lockAcquired = false;
    let payload: any;

    if (trackResult && jobId) {
      const existingJob = await this.sqsTransitionService.findJob(jobId);
      if (existingJob?.status === 'completed') {
        return (existingJob as any).result || { ok: true, skipped: true, jobId, status: 'completed' };
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
      logEvent('info', 'queue.message.started', {
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
        await this.runnerService.persistWebhookRunState(payload, result).catch((error: any) => {
          logEvent('warn', 'queue.webhook_state.failed', {
            jobId,
            error: getErrorDetails(error),
          });
        });
      }
      if (payload?._webhookAsync) {
        await this.runnerService.deliverWebhookCallback(payload._webhookAsync, result).catch((error: any) => {
          logEvent('warn', 'queue.webhook_callback.failed', {
            jobId,
            error: getErrorDetails(error),
          });
        });
      }
      logEvent('info', 'queue.message.completed', {
        type,
        jobId,
        lockKey,
        durationMs: Date.now() - startedAt,
        status: (result as any)?.ended ? 'ended' : 'ok',
      });
      return result;
    } catch (error: any) {
      if (trackResult && !error?.retryable) {
        await this.sqsTransitionService.markFailed(jobId, error);
      }
      if (payload?._webhookAsync && !error?.retryable) {
        await this.runnerService.deliverWebhookCallback(payload._webhookAsync, undefined, error).catch(() => undefined);
      }
      logEvent(error?.retryable ? 'warn' : 'error', 'queue.message.failed', {
        type,
        jobId,
        lockKey,
        retryable: Boolean(error?.retryable),
        error: getErrorDetails(error),
      });
      throw error;
    } finally {
      if (lockAcquired) {
        await this.sqsTransitionService.releaseConversationLock(lockKey, ownerId).catch(() => undefined);
      }
    }
  }

  async processRecord(record: any) {
    return await this.processEnvelope(this.parseRecord(record));
  }

  async processRecords(records: any[]) {
    const results: any[] = [];
    const failures: any[] = [];
    const batchItemFailures: any[] = [];
    const groups = new Map<string, Array<{ record: any; index: number }>>();

    for (let index = 0; index < records.length; index += 1) {
      const groupId = this.getRecordGroupId(records[index], index);
      const group = groups.get(groupId) || [];
      group.push({ record: records[index], index });
      groups.set(groupId, group);
    }

    const groupedRecords = Array.from(groups.values());
    let nextGroupIndex = 0;
    const workerCount = Math.min(this.consumerConcurrency(), groupedRecords.length || 1);

    const processOne = async (record: any, index: number) => {
      try {
        results.push(await this.processRecord(record));
      } catch (error: any) {
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

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextGroupIndex < groupedRecords.length) {
          const group = groupedRecords[nextGroupIndex];
          nextGroupIndex += 1;
          for (const item of group) {
            await processOne(item.record, item.index);
          }
        }
      }),
    );

    return {
      consumed: results.length - failures.length,
      failed: failures.length,
      failures,
      batchItemFailures,
      results,
    };
  }
}
