import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
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
}>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: {
        createdAt: true;
        updatedAt: false;
    };
}>> & mongoose.FlatRecord<{
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
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class FlowTagEventEntity extends Document {
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
    idempotencyKey?: string;
    createdAt: Date;
}
