import { Connection } from 'mongoose';
export declare const connectProviders: {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
        conversationId: string;
        metadata: any;
        tag: string;
        mode: "once" | "always";
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        value?: any;
        channel?: string;
        flowName?: string;
        label?: string;
        stepTitle?: string;
        stepType?: string;
        input?: string;
        entryFlowId?: string;
        activeFlowId?: string;
        stepId?: string;
        idempotencyKey?: string;
        createdAt: NativeDate;
    }, {}, {}, {}, import("mongoose").Document<unknown, {}, {
        conversationId: string;
        metadata: any;
        tag: string;
        mode: "once" | "always";
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        value?: any;
        channel?: string;
        flowName?: string;
        label?: string;
        stepTitle?: string;
        stepType?: string;
        input?: string;
        entryFlowId?: string;
        activeFlowId?: string;
        stepId?: string;
        idempotencyKey?: string;
        createdAt: NativeDate;
    }, {}, {}> & {
        conversationId: string;
        metadata: any;
        tag: string;
        mode: "once" | "always";
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        value?: any;
        channel?: string;
        flowName?: string;
        label?: string;
        stepTitle?: string;
        stepType?: string;
        input?: string;
        entryFlowId?: string;
        activeFlowId?: string;
        stepId?: string;
        idempotencyKey?: string;
        createdAt: NativeDate;
    } & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
        collection: string;
        timestamps: {
            createdAt: true;
            updatedAt: false;
        };
    }, {
        conversationId: string;
        metadata: any;
        tag: string;
        mode: "once" | "always";
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        value?: any;
        channel?: string;
        flowName?: string;
        label?: string;
        stepTitle?: string;
        stepType?: string;
        input?: string;
        entryFlowId?: string;
        activeFlowId?: string;
        stepId?: string;
        idempotencyKey?: string;
        createdAt: NativeDate;
    }, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
        conversationId: string;
        metadata: any;
        tag: string;
        mode: "once" | "always";
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        value?: any;
        channel?: string;
        flowName?: string;
        label?: string;
        stepTitle?: string;
        stepType?: string;
        input?: string;
        entryFlowId?: string;
        activeFlowId?: string;
        stepId?: string;
        idempotencyKey?: string;
        createdAt: NativeDate;
    }>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: {
            createdAt: true;
            updatedAt: false;
        };
    }>> & import("mongoose").FlatRecord<{
        conversationId: string;
        metadata: any;
        tag: string;
        mode: "once" | "always";
        organizationId?: string;
        agentId?: string;
        flowId?: string;
        value?: any;
        channel?: string;
        flowName?: string;
        label?: string;
        stepTitle?: string;
        stepType?: string;
        input?: string;
        entryFlowId?: string;
        activeFlowId?: string;
        stepId?: string;
        idempotencyKey?: string;
        createdAt: NativeDate;
    }> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
}[];
