import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    limit: number;
    count: number;
    expiresAt: NativeDate;
    bucketKey: string;
    windowStartedAt: NativeDate;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    limit: number;
    count: number;
    expiresAt: NativeDate;
    bucketKey: string;
    windowStartedAt: NativeDate;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    limit: number;
    count: number;
    expiresAt: NativeDate;
    bucketKey: string;
    windowStartedAt: NativeDate;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class QueueRateLimitEntity extends Document {
    bucketKey: string;
    count: number;
    limit: number;
    windowStartedAt: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
