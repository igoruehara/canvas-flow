import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    expiresAt: NativeDate;
    lockKey: string;
    ownerId: string;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    expiresAt: NativeDate;
    lockKey: string;
    ownerId: string;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    expiresAt: NativeDate;
    lockKey: string;
    ownerId: string;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class QueueLockEntity extends Document {
    lockKey: string;
    ownerId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
