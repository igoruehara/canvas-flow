import { Connection } from 'mongoose';
export declare const connectProviders: {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
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
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
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
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
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
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
}[];
