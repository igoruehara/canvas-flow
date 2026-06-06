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
exports.MemoryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("mongoose");
const memory_constants_model_1 = require("./memory-constants-model");
let MemoryService = class MemoryService {
    constructor(model, historyModel, traceHistoryModel) {
        this.model = model;
        this.historyModel = historyModel;
        this.traceHistoryModel = traceHistoryModel;
    }
    isMessageHistoryTurn(turn) {
        return turn.metadata?.kind === 'message';
    }
    async addTurn(turn) {
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
        }
        catch (error) {
            return { skipped: true, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async addHistoryTurn(turn) {
        try {
            return await new this.historyModel(turn).save();
        }
        catch (error) {
            return { skipped: true, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async addTraceTurn(turn) {
        try {
            return await new this.traceHistoryModel(turn).save();
        }
        catch (error) {
            return { skipped: true, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async findRecent(agentId, conversationId, limit = 20, scope) {
        const query = { conversationId };
        if (agentId)
            query.agentId = agentId;
        if (scope?.organizationId)
            query['metadata.organizationId'] = scope.organizationId;
        if (scope?.metadataKind)
            query['metadata.kind'] = scope.metadataKind;
        if (scope?.conversationOwnerId)
            query['metadata.conversationOwnerId'] = scope.conversationOwnerId;
        try {
            const rows = await this.model
                .find(query)
                .sort({ createdAt: -1 })
                .limit(Math.max(0, limit))
                .lean()
                .exec();
            return rows.reverse();
        }
        catch {
            return [];
        }
    }
    async findHistory(filters) {
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
        }
        catch {
            return { items: [], total: 0, page, limit, skip, totalPages: 0 };
        }
    }
    buildHistoryQuery(filters) {
        const query = {};
        if (filters.agentId)
            query.agentId = filters.agentId;
        if (filters.conversationId) {
            query.conversationId = filters.conversationId;
        }
        else if (Array.isArray(filters.conversationIds)) {
            const conversationIds = filters.conversationIds.map((id) => String(id || '').trim()).filter(Boolean);
            if (conversationIds.length)
                query.conversationId = { $in: conversationIds };
        }
        if (filters.organizationId)
            query['metadata.organizationId'] = filters.organizationId;
        if (filters.metadataKind)
            query['metadata.kind'] = filters.metadataKind;
        if (filters.flowId) {
            query.$or = [
                { 'metadata.flowId': filters.flowId },
                { 'metadata.entryFlowId': filters.flowId },
                { 'metadata.activeFlowId': filters.flowId },
            ];
        }
        const createdAt = {};
        if (filters.dateFrom) {
            const date = new Date(filters.dateFrom);
            if (!Number.isNaN(date.getTime()))
                createdAt.$gte = date;
        }
        if (filters.dateTo) {
            const date = new Date(filters.dateTo);
            if (!Number.isNaN(date.getTime()))
                createdAt.$lte = date;
        }
        if (Object.keys(createdAt).length)
            query.createdAt = createdAt;
        return query;
    }
    async findLegacyHistory(query, pagination) {
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
        }
        catch {
            return { items: [], total: 0, page, limit, skip, totalPages: 0 };
        }
    }
    async clearConversation(agentId, conversationId, scope) {
        const query = { conversationId };
        if (agentId)
            query.agentId = agentId;
        if (scope?.organizationId)
            query['metadata.organizationId'] = scope.organizationId;
        if (scope?.conversationOwnerId)
            query['metadata.conversationOwnerId'] = scope.conversationOwnerId;
        try {
            return await this.model.deleteMany(query).exec();
        }
        catch (error) {
            return { acknowledged: false, deletedCount: 0, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async getMessageInsights(filters) {
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
            const totalMessages = byRole.reduce((sum, item) => sum + Number(item.count || 0), 0);
            const stats = conversationStats?.[0] || {};
            const conversations = Number(stats.conversations || 0);
            const userMessages = Number(byRole.find((item) => item.role === 'user')?.count || 0);
            const assistantMessages = Number(byRole.find((item) => item.role === 'assistant')?.count || 0);
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
        }
        catch {
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
    async findTraceHistory(filters) {
        const query = this.buildHistoryQuery({ ...filters, metadataKind: 'trace' });
        const limit = Math.max(1, Math.min(Number(filters.limit || 300), 1000));
        try {
            return await this.traceHistoryModel.find(query).sort({ createdAt: -1 }).limit(limit).lean().exec();
        }
        catch {
            return [];
        }
    }
};
exports.MemoryService = MemoryService;
exports.MemoryService = MemoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(memory_constants_model_1.MODEL_NAME)),
    __param(1, (0, common_1.Inject)(memory_constants_model_1.HISTORY_MODEL_NAME)),
    __param(2, (0, common_1.Inject)(memory_constants_model_1.TRACE_HISTORY_MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        mongoose_1.Model,
        mongoose_1.Model])
], MemoryService);
//# sourceMappingURL=memory-service.js.map