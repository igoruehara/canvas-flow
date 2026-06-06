import { Connection } from 'mongoose';
export declare const connectProviders: {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
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
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
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
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
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
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
}[];
