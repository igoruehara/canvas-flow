import { Model } from 'mongoose';
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
export declare class FlowTagService {
    private model;
    constructor(model: Model<FlowTagEventEntity>);
    private cleanTag;
    private buildOnceKey;
    record(event: FlowTagEventInput): Promise<(import("mongoose").Document<unknown, {}, FlowTagEventEntity, {}, {}> & FlowTagEventEntity & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | (import("mongoose").FlattenMaps<FlowTagEventEntity> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | {
        skipped: boolean;
        duplicate?: undefined;
        error?: undefined;
    } | {
        skipped: boolean;
        duplicate: boolean;
        error?: undefined;
    } | {
        skipped: boolean;
        error: string;
        duplicate?: undefined;
    }>;
    private buildQuery;
    dashboard(filters: FlowTagDashboardFilters): Promise<{
        filters: FlowTagDashboardFilters;
        summary: {
            total: number;
            conversations: number;
            tags: number;
            flows: number;
        };
        byTag: any[];
        byFlow: any[];
        events: (import("mongoose").FlattenMaps<FlowTagEventEntity> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        conversationIds: any;
    }>;
}
