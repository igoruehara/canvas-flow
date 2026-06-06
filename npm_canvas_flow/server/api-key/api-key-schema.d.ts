import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    name: string;
    active: boolean;
    tokenHash: string;
    tokenPrefix: string;
    scopes: string[];
    totalUses: number;
    organizationId?: string;
    createdBy?: string;
    agentId?: string;
    flowId?: string;
    expiresAt?: NativeDate;
    revokedAt?: NativeDate;
    lastUsedAt?: NativeDate;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    name: string;
    active: boolean;
    tokenHash: string;
    tokenPrefix: string;
    scopes: string[];
    totalUses: number;
    organizationId?: string;
    createdBy?: string;
    agentId?: string;
    flowId?: string;
    expiresAt?: NativeDate;
    revokedAt?: NativeDate;
    lastUsedAt?: NativeDate;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    name: string;
    active: boolean;
    tokenHash: string;
    tokenPrefix: string;
    scopes: string[];
    totalUses: number;
    organizationId?: string;
    createdBy?: string;
    agentId?: string;
    flowId?: string;
    expiresAt?: NativeDate;
    revokedAt?: NativeDate;
    lastUsedAt?: NativeDate;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class CanvasFlowApiKeyEntity extends Document {
    name: string;
    tokenHash: string;
    tokenPrefix: string;
    flowId?: string;
    agentId?: string;
    organizationId?: string;
    scopes: string[];
    active: boolean;
    expiresAt?: Date;
    revokedAt?: Date;
    lastUsedAt?: Date;
    totalUses: number;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
