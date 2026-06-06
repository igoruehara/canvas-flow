import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { MODEL_NAME } from './flow-tag-constants-model';
import { FlowTagEventEntity } from './flow-tag-schema';

export interface FlowTagEventInput {
  organizationId?: string;
  agentId?: string;
  flowId?: string;
  flowName?: string;
  entryFlowId?: string;
  activeFlowId?: string;
  conversationId: string;
  channel?: string;
  stepId?: string;
  stepTitle?: string;
  stepType?: string;
  tag: string;
  label?: string;
  mode?: 'once' | 'always';
  value?: any;
  metadata?: Record<string, any>;
  input?: string;
}

export interface FlowTagDashboardFilters {
  organizationId?: string;
  agentId?: string;
  flowId?: string;
  conversationId?: string;
  tag?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

@Injectable()
export class FlowTagService {
  constructor(@Inject(MODEL_NAME) private model: Model<FlowTagEventEntity>) {}

  private cleanTag(value: any) {
    return String(value || '').trim();
  }

  private buildOnceKey(event: FlowTagEventInput) {
    return [
      event.organizationId || '',
      event.agentId || '',
      event.flowId || '',
      event.conversationId || '',
      event.stepId || '',
      event.tag || '',
    ].join('|');
  }

  async record(event: FlowTagEventInput) {
    const tag = this.cleanTag(event.tag);
    if (!tag || !event.conversationId) return { skipped: true };

    const mode = event.mode === 'once' ? 'once' : 'always';
    const payload = {
      ...event,
      tag,
      mode,
      createdAt: new Date(),
      ...(mode === 'once' ? { idempotencyKey: this.buildOnceKey({ ...event, tag }) } : {}),
    };

    try {
      if (mode === 'once') {
        return await this.model
          .findOneAndUpdate(
            { idempotencyKey: payload.idempotencyKey },
            { $setOnInsert: payload },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          )
          .lean()
          .exec();
      }
      return await new this.model(payload).save();
    } catch (error: any) {
      if (error?.code === 11000) return { skipped: true, duplicate: true };
      return { skipped: true, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private buildQuery(filters: FlowTagDashboardFilters) {
    const query: Record<string, any> = {};
    if (filters.organizationId) query.organizationId = filters.organizationId;
    if (filters.agentId) query.agentId = filters.agentId;
    if (filters.flowId) {
      query.$or = [{ flowId: filters.flowId }, { entryFlowId: filters.flowId }, { activeFlowId: filters.flowId }];
    }
    if (filters.conversationId) query.conversationId = filters.conversationId;
    const tags = Array.isArray(filters.tags)
      ? filters.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
      : String(filters.tag || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    if (tags.length === 1) query.tag = tags[0];
    if (tags.length > 1) query.tag = { $in: tags };

    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) {
      const date = new Date(filters.dateFrom);
      if (!Number.isNaN(date.getTime())) createdAt.$gte = date;
    }
    if (filters.dateTo) {
      const date = new Date(filters.dateTo);
      if (!Number.isNaN(date.getTime())) createdAt.$lte = date;
    }
    if (Object.keys(createdAt).length) query.createdAt = createdAt;
    return query;
  }

  async dashboard(filters: FlowTagDashboardFilters) {
    const query = this.buildQuery(filters);
    const limit = Math.max(1, Math.min(Number(filters.limit || 100), 500));
    const [events, byTag, byFlow, total, conversationSummary] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).limit(limit).lean().exec(),
      this.model.aggregate([
        { $match: query },
        { $group: { _id: '$tag', count: { $sum: 1 }, conversations: { $addToSet: '$conversationId' } } },
        { $project: { tag: '$_id', count: 1, conversations: { $size: '$conversations' }, _id: 0 } },
        { $sort: { count: -1, tag: 1 } },
        { $limit: 50 },
      ]).exec(),
      this.model.aggregate([
        { $match: query },
        { $group: { _id: { flowId: '$flowId', flowName: '$flowName' }, count: { $sum: 1 } } },
        { $project: { flowId: '$_id.flowId', flowName: '$_id.flowName', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]).exec(),
      this.model.countDocuments(query).exec(),
      this.model.aggregate([
        { $match: query },
        { $group: { _id: '$conversationId' } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            samples: [{ $limit: 500 }, { $project: { conversationId: '$_id', _id: 0 } }],
          },
        },
      ]).exec(),
    ]);
    const conversationStats = conversationSummary?.[0] || {};
    const conversationCount = Number(conversationStats.total?.[0]?.count || 0);
    const conversationIds = Array.isArray(conversationStats.samples)
      ? conversationStats.samples.map((item: any) => item.conversationId).filter(Boolean)
      : [];

    return {
      filters,
      summary: {
        total,
        conversations: conversationCount,
        tags: byTag.length,
        flows: byFlow.filter((item: any) => item.flowId).length,
      },
      byTag,
      byFlow,
      events,
      conversationIds,
    };
  }
}
