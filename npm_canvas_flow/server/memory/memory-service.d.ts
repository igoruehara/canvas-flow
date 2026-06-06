import { Model } from 'mongoose';
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
export declare class MemoryService {
    private model;
    private historyModel;
    private traceHistoryModel;
    constructor(model: Model<MemoryTurnEntity>, historyModel: Model<MemoryHistoryEntity>, traceHistoryModel: Model<TraceHistoryEntity>);
    private isMessageHistoryTurn;
    addTurn(turn: CreateMemoryTurn): Promise<(import("mongoose").Document<unknown, {}, MemoryTurnEntity, {}, {}> & MemoryTurnEntity & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | {
        skipped: boolean;
        error: string;
    }>;
    addHistoryTurn(turn: CreateMemoryTurn): Promise<(import("mongoose").Document<unknown, {}, MemoryHistoryEntity, {}, {}> & MemoryHistoryEntity & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | {
        skipped: boolean;
        error: string;
    }>;
    addTraceTurn(turn: CreateMemoryTurn): Promise<(import("mongoose").Document<unknown, {}, TraceHistoryEntity, {}, {}> & TraceHistoryEntity & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | {
        skipped: boolean;
        error: string;
    }>;
    findRecent(agentId: string | undefined, conversationId: string, limit?: number, scope?: {
        organizationId?: string;
        metadataKind?: string;
        conversationOwnerId?: string;
    }): Promise<(import("mongoose").FlattenMaps<MemoryTurnEntity> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    findHistory(filters: {
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
    }): Promise<{
        items: (import("mongoose").FlattenMaps<MemoryTurnEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        limit: number;
        skip: number;
        totalPages: number;
    } | {
        items: (import("mongoose").FlattenMaps<MemoryHistoryEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        limit: number;
        skip: number;
        totalPages: number;
    }>;
    private buildHistoryQuery;
    private findLegacyHistory;
    clearConversation(agentId: string | undefined, conversationId: string, scope?: {
        organizationId?: string;
        conversationOwnerId?: string;
    }): Promise<import("mongodb").DeleteResult | {
        acknowledged: boolean;
        deletedCount: number;
        error: string;
    }>;
    getMessageInsights(filters: {
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        conversationId?: string;
        conversationIds?: string[];
        dateFrom?: string;
        dateTo?: string;
    }): Promise<{
        summary: {
            totalMessages: any;
            userMessages: number;
            assistantMessages: number;
            conversations: number;
            avgMessagesPerConversation: number;
            avgUserMessagesPerConversation: number;
            longConversations: number;
        };
        byRole: any[];
        byChannel: any[];
        byFlow: any[];
        topConversations: any[];
        daily: any[];
    }>;
    findTraceHistory(filters: {
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        conversationId?: string;
        conversationIds?: string[];
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
    }): Promise<(import("mongoose").FlattenMaps<TraceHistoryEntity> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
