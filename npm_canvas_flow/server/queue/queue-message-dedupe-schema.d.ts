import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    status: "completed" | "failed" | "processing";
    expiresAt: NativeDate;
    startedAt: NativeDate;
    dedupeKey: string;
    attempts: number;
    organizationId?: string;
    error?: string;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    channel?: string;
    provider?: string;
    completedAt?: NativeDate;
    failedAt?: NativeDate;
    providerMessageId?: string;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    status: "completed" | "failed" | "processing";
    expiresAt: NativeDate;
    startedAt: NativeDate;
    dedupeKey: string;
    attempts: number;
    organizationId?: string;
    error?: string;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    channel?: string;
    provider?: string;
    completedAt?: NativeDate;
    failedAt?: NativeDate;
    providerMessageId?: string;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    status: "completed" | "failed" | "processing";
    expiresAt: NativeDate;
    startedAt: NativeDate;
    dedupeKey: string;
    attempts: number;
    organizationId?: string;
    error?: string;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    channel?: string;
    provider?: string;
    completedAt?: NativeDate;
    failedAt?: NativeDate;
    providerMessageId?: string;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class QueueMessageDedupeEntity extends Document {
    dedupeKey: string;
    status: 'processing' | 'completed' | 'failed';
    organizationId?: string;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    channel?: string;
    provider?: string;
    providerMessageId?: string;
    attempts?: number;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
