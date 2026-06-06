import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    key: string;
    settings: any;
    updatedBy?: string;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    key: string;
    settings: any;
    updatedBy?: string;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    key: string;
    settings: any;
    updatedBy?: string;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class ProviderConfigEntity extends Document {
    key: string;
    settings: Record<string, any>;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
