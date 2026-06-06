import { Connection } from 'mongoose';
export declare const messageDedupeConnectProviders: {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
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
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
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
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
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
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
}[];
