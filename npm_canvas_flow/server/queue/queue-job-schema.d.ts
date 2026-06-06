import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    type: string;
    metadata: any;
    status: "queued" | "running" | "completed" | "failed";
    jobId: string;
    queuedAt: NativeDate;
    organizationId?: string;
    error?: string;
    result?: any;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    expiresAt?: NativeDate;
    messageId?: string;
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    failedAt?: NativeDate;
    payload?: any;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    type: string;
    metadata: any;
    status: "queued" | "running" | "completed" | "failed";
    jobId: string;
    queuedAt: NativeDate;
    organizationId?: string;
    error?: string;
    result?: any;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    expiresAt?: NativeDate;
    messageId?: string;
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    failedAt?: NativeDate;
    payload?: any;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    type: string;
    metadata: any;
    status: "queued" | "running" | "completed" | "failed";
    jobId: string;
    queuedAt: NativeDate;
    organizationId?: string;
    error?: string;
    result?: any;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    expiresAt?: NativeDate;
    messageId?: string;
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    failedAt?: NativeDate;
    payload?: any;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class QueueJobEntity extends Document {
    jobId: string;
    type: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    organizationId?: string;
    agentId?: string;
    flowId?: string;
    conversationId?: string;
    messageId?: string;
    payload?: Record<string, any>;
    result?: Record<string, any>;
    error?: string;
    metadata?: Record<string, any>;
    queuedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
