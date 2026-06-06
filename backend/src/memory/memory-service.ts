import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { HISTORY_MODEL_NAME, MODEL_NAME, TRACE_HISTORY_MODEL_NAME } from './memory-constants-model';
import { MemoryHistoryEntity } from './memory-history-schema';
import { MemoryTurnEntity } from './memory-schema';
import { TraceHistoryEntity } from './memory-trace-history-schema';

export interface CreateMemoryTurn {
  agentId?: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class MemoryService {
  constructor(
    @Inject(MODEL_NAME) private model: Model<MemoryTurnEntity>,
    @Inject(HISTORY_MODEL_NAME) private historyModel: Model<MemoryHistoryEntity>,
    @Inject(TRACE_HISTORY_MODEL_NAME) private traceHistoryModel: Model<TraceHistoryEntity>,
  ) {}

  private isMessageHistoryTurn(turn: CreateMemoryTurn) {
    return turn.metadata?.kind === 'message';
  }

  async addTurn(turn: CreateMemoryTurn) {
    try {
      const saved = await new this.model(turn).save();
      if (this.isMessageHistoryTurn(turn)) {
        await this.addHistoryTurn({
          ...turn,
          metadata: {
            ...(turn.metadata || {}),
            runtimeTurnId: String(saved._id),
          },
        });
      }
      return saved;
    } catch (error) {
      return { skipped: true, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async addHistoryTurn(turn: CreateMemoryTurn) {
    try {
      return await new this.historyModel(turn).save();
    } catch (error) {
      return { skipped: true, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async addTraceTurn(turn: CreateMemoryTurn) {
    try {
      return await new this.traceHistoryModel(turn).save();
    } catch (error) {
      return { skipped: true, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async findRecent(
    agentId: string | undefined,
    conversationId: string,
    limit = 20,
    scope?: {
      organizationId?: string;
      metadataKind?: string;
      conversationOwnerId?: string;
    },
  ) {
    const query: Record<string, any> = { conversationId };
    if (agentId) query.agentId = agentId;
    if (scope?.organizationId) query['metadata.organizationId'] = scope.organizationId;
    if (scope?.metadataKind) query['metadata.kind'] = scope.metadataKind;
    if (scope?.conversationOwnerId) query['metadata.conversationOwnerId'] = scope.conversationOwnerId;
    try {
      const rows = await this.model
        .find(query)
        .sort({ createdAt: -1 })
        .limit(Math.max(0, limit))
        .lean()
        .exec();
      return rows.reverse();
    } catch {
      return [];
    }
  }

  async findHistory(filters: {
    organizationId?: string;
    agentId?: string;
    conversationId?: string;
    conversationIds?: string[];
    metadataKind?: string;
    flowId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    page?: number;
    skip?: number;
  }) {
    const query = this.buildHistoryQuery(filters);

    const limit = Math.max(1, Math.min(Number(filters.limit || 50), 500));
    const page = Math.max(1, Math.floor(Number(filters.page || 1)));
    const explicitSkip = Number(filters.skip);
    const skip = Number.isFinite(explicitSkip) && explicitSkip >= 0 ? Math.floor(explicitSkip) : (page - 1) * limit;

    try {
      const [items, total] = await Promise.all([
        this.historyModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.historyModel.countDocuments(query).exec(),
      ]);
      if (!items.length && total === 0) {
        return await this.findLegacyHistory(query, { limit, page, skip });
      }
      return {
        items,
        total,
        page,
        limit,
        skip,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      };
    } catch {
      return { items: [], total: 0, page, limit, skip, totalPages: 0 };
    }
  }

  private buildHistoryQuery(filters: {
    organizationId?: string;
    agentId?: string;
    conversationId?: string;
    conversationIds?: string[];
    metadataKind?: string;
    flowId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const query: Record<string, any> = {};
    if (filters.agentId) query.agentId = filters.agentId;
    if (filters.conversationId) {
      query.conversationId = filters.conversationId;
    } else if (Array.isArray(filters.conversationIds)) {
      const conversationIds = filters.conversationIds.map((id) => String(id || '').trim()).filter(Boolean);
      if (conversationIds.length) query.conversationId = { $in: conversationIds };
    }
    if (filters.organizationId) query['metadata.organizationId'] = filters.organizationId;
    if (filters.metadataKind) query['metadata.kind'] = filters.metadataKind;
    if (filters.flowId) {
      query.$or = [
        { 'metadata.flowId': filters.flowId },
        { 'metadata.entryFlowId': filters.flowId },
        { 'metadata.activeFlowId': filters.flowId },
      ];
    }
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

  private async findLegacyHistory(query: Record<string, any>, pagination: { limit: number; page: number; skip: number }) {
    const { limit, page, skip } = pagination;
    try {
      const [items, total] = await Promise.all([
        this.model
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.model.countDocuments(query).exec(),
      ]);
      return {
        items,
        total,
        page,
        limit,
        skip,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      };
    } catch {
      return { items: [], total: 0, page, limit, skip, totalPages: 0 };
    }
  }

  async clearConversation(
    agentId: string | undefined,
    conversationId: string,
    scope?: {
      organizationId?: string;
      conversationOwnerId?: string;
    },
  ) {
    const query: Record<string, any> = { conversationId };
    if (agentId) query.agentId = agentId;
    if (scope?.organizationId) query['metadata.organizationId'] = scope.organizationId;
    if (scope?.conversationOwnerId) query['metadata.conversationOwnerId'] = scope.conversationOwnerId;
    try {
      return await this.model.deleteMany(query).exec();
    } catch (error) {
      return { acknowledged: false, deletedCount: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getMessageInsights(filters: {
    organizationId?: string;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    conversationIds?: string[];
    dateFrom?: string;
    dateTo?: string;
  }) {
    const query = this.buildHistoryQuery({ ...filters, metadataKind: 'message' });
    try {
      const [byRole, byChannel, byFlow, conversationRows, conversationStats, daily] = await Promise.all([
        this.historyModel.aggregate([
          { $match: query },
          { $group: { _id: '$role', count: { $sum: 1 } } },
          { $project: { role: '$_id', count: 1, _id: 0 } },
          { $sort: { count: -1 } },
        ]).exec(),
        this.historyModel.aggregate([
          { $match: query },
          { $group: { _id: '$metadata.channel', count: { $sum: 1 }, conversations: { $addToSet: '$conversationId' } } },
          { $project: { channel: { $ifNull: ['$_id', ''] }, count: 1, conversations: { $size: '$conversations' }, _id: 0 } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]).exec(),
        this.historyModel.aggregate([
          { $match: query },
          { $group: { _id: { flowId: '$metadata.flowId', flowName: '$metadata.flowName' }, count: { $sum: 1 }, conversations: { $addToSet: '$conversationId' } } },
          { $project: { flowId: '$_id.flowId', flowName: '$_id.flowName', count: 1, conversations: { $size: '$conversations' }, _id: 0 } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]).exec(),
        this.historyModel.aggregate([
          { $match: query },
          { $group: { _id: '$conversationId', messages: { $sum: 1 }, userMessages: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } }, assistantMessages: { $sum: { $cond: [{ $eq: ['$role', 'assistant'] }, 1, 0] } }, lastAt: { $max: '$createdAt' } } },
          { $sort: { messages: -1, lastAt: -1 } },
          { $limit: 20 },
          { $project: { conversationId: '$_id', messages: 1, userMessages: 1, assistantMessages: 1, lastAt: 1, _id: 0 } },
        ]).exec(),
        this.historyModel.aggregate([
          { $match: query },
          { $group: { _id: '$conversationId', messages: { $sum: 1 }, userMessages: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } } } },
          {
            $group: {
              _id: null,
              conversations: { $sum: 1 },
              longConversations: { $sum: { $cond: [{ $gte: ['$userMessages', 5] }, 1, 0] } },
            },
          },
          { $project: { _id: 0, conversations: 1, longConversations: 1 } },
        ]).exec(),
        this.historyModel.aggregate([
          { $match: query },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              messages: { $sum: 1 },
              conversations: { $addToSet: '$conversationId' },
            },
          },
          { $project: { date: '$_id', messages: 1, conversations: { $size: '$conversations' }, _id: 0 } },
          { $sort: { date: 1 } },
          { $limit: 90 },
        ]).exec(),
      ]);
      const totalMessages = byRole.reduce((sum: number, item: any) => sum + Number(item.count || 0), 0);
      const stats = conversationStats?.[0] || {};
      const conversations = Number(stats.conversations || 0);
      const userMessages = Number(byRole.find((item: any) => item.role === 'user')?.count || 0);
      const assistantMessages = Number(byRole.find((item: any) => item.role === 'assistant')?.count || 0);
      const longConversations = Number(stats.longConversations || 0);
      return {
        summary: {
          totalMessages,
          userMessages,
          assistantMessages,
          conversations,
          avgMessagesPerConversation: conversations ? totalMessages / conversations : 0,
          avgUserMessagesPerConversation: conversations ? userMessages / conversations : 0,
          longConversations,
        },
        byRole,
        byChannel,
        byFlow,
        topConversations: conversationRows,
        daily,
      };
    } catch {
      return {
        summary: {
          totalMessages: 0,
          userMessages: 0,
          assistantMessages: 0,
          conversations: 0,
          avgMessagesPerConversation: 0,
          avgUserMessagesPerConversation: 0,
          longConversations: 0,
        },
        byRole: [],
        byChannel: [],
        byFlow: [],
        topConversations: [],
        daily: [],
      };
    }
  }

  async findTraceHistory(filters: {
    organizationId?: string;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    conversationIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) {
    const query = this.buildHistoryQuery({ ...filters, metadataKind: 'trace' });
    const limit = Math.max(1, Math.min(Number(filters.limit || 300), 1000));
    try {
      return await this.traceHistoryModel.find(query).sort({ createdAt: -1 }).limit(limit).lean().exec();
    } catch {
      return [];
    }
  }
}
