import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const OrganizationEntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    organizationId: string;
    name: string;
    slug: string;
    active: boolean;
    ownerUserId?: string;
    createdByEmail?: string;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    organizationId: string;
    name: string;
    slug: string;
    active: boolean;
    ownerUserId?: string;
    createdByEmail?: string;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    organizationId: string;
    name: string;
    slug: string;
    active: boolean;
    ownerUserId?: string;
    createdByEmail?: string;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class CanvasFlowOrganizationEntity extends Document {
    organizationId: string;
    name: string;
    slug: string;
    active: boolean;
    ownerUserId?: string;
    createdByEmail?: string;
    createdAt: Date;
    updatedAt: Date;
}
