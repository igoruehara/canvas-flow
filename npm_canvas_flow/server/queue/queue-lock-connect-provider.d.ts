import { Connection } from 'mongoose';
export declare const lockConnectProviders: {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
        expiresAt: NativeDate;
        lockKey: string;
        ownerId: string;
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
        expiresAt: NativeDate;
        lockKey: string;
        ownerId: string;
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
        expiresAt: NativeDate;
        lockKey: string;
        ownerId: string;
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
        collection: string;
        timestamps: true;
    }, {
        expiresAt: NativeDate;
        lockKey: string;
        ownerId: string;
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
        expiresAt: NativeDate;
        lockKey: string;
        ownerId: string;
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
        expiresAt: NativeDate;
        lockKey: string;
        ownerId: string;
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
}[];
