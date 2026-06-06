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
exports.FlowTagService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("mongoose");
const flow_tag_constants_model_1 = require("./flow-tag-constants-model");
let FlowTagService = class FlowTagService {
    constructor(model) {
        this.model = model;
    }
    cleanTag(value) {
        return String(value || '').trim();
    }
    buildOnceKey(event) {
        return [
            event.organizationId || '',
            event.agentId || '',
            event.flowId || '',
            event.conversationId || '',
            event.stepId || '',
            event.tag || '',
        ].join('|');
    }
    async record(event) {
        const tag = this.cleanTag(event.tag);
        if (!tag || !event.conversationId)
            return { skipped: true };
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
                    .findOneAndUpdate({ idempotencyKey: payload.idempotencyKey }, { $setOnInsert: payload }, { upsert: true, new: true, setDefaultsOnInsert: true })
                    .lean()
                    .exec();
            }
            return await new this.model(payload).save();
        }
        catch (error) {
            if (error?.code === 11000)
                return { skipped: true, duplicate: true };
            return { skipped: true, error: error instanceof Error ? error.message : String(error) };
        }
    }
    buildQuery(filters) {
        const query = {};
        if (filters.organizationId)
            query.organizationId = filters.organizationId;
        if (filters.agentId)
            query.agentId = filters.agentId;
        if (filters.flowId) {
            query.$or = [{ flowId: filters.flowId }, { entryFlowId: filters.flowId }, { activeFlowId: filters.flowId }];
        }
        if (filters.conversationId)
            query.conversationId = filters.conversationId;
        const tags = Array.isArray(filters.tags)
            ? filters.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : String(filters.tag || '')
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
        if (tags.length === 1)
            query.tag = tags[0];
        if (tags.length > 1)
            query.tag = { $in: tags };
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
    async dashboard(filters) {
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
            ? conversationStats.samples.map((item) => item.conversationId).filter(Boolean)
            : [];
        return {
            filters,
            summary: {
                total,
                conversations: conversationCount,
                tags: byTag.length,
                flows: byFlow.filter((item) => item.flowId).length,
            },
            byTag,
            byFlow,
            events,
            conversationIds,
        };
    }
};
exports.FlowTagService = FlowTagService;
exports.FlowTagService = FlowTagService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(flow_tag_constants_model_1.MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model])
], FlowTagService);
//# sourceMappingURL=flow-tag-service.js.map