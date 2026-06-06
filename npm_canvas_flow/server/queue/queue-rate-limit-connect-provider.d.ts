import { Connection } from 'mongoose';
export declare const rateLimitConnectProviders: {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
        limit: number;
        count: number;
        expiresAt: NativeDate;
        bucketKey: string;
        windowStartedAt: NativeDate;
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
        limit: number;
        count: number;
        expiresAt: NativeDate;
        bucketKey: string;
        windowStartedAt: NativeDate;
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
        limit: number;
        count: number;
        expiresAt: NativeDate;
        bucketKey: string;
        windowStartedAt: NativeDate;
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
        collection: string;
        timestamps: true;
    }, {
        limit: number;
        count: number;
        expiresAt: NativeDate;
        bucketKey: string;
        windowStartedAt: NativeDate;
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
        limit: number;
        count: number;
        expiresAt: NativeDate;
        bucketKey: string;
        windowStartedAt: NativeDate;
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
        limit: number;
        count: number;
        expiresAt: NativeDate;
        bucketKey: string;
        windowStartedAt: NativeDate;
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
}[];
