import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    organizationId: string;
    name: string;
    active: boolean;
    organizationName: string;
    organizationSlug: string;
    email: string;
    passwordHash: string;
    role: "owner" | "admin" | "member";
    lastLoginAt?: NativeDate;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    organizationId: string;
    name: string;
    active: boolean;
    organizationName: string;
    organizationSlug: string;
    email: string;
    passwordHash: string;
    role: "owner" | "admin" | "member";
    lastLoginAt?: NativeDate;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    organizationId: string;
    name: string;
    active: boolean;
    organizationName: string;
    organizationSlug: string;
    email: string;
    passwordHash: string;
    role: "owner" | "admin" | "member";
    lastLoginAt?: NativeDate;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class CanvasFlowUserEntity extends Document {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    email: string;
    name: string;
    passwordHash: string;
    role: 'owner' | 'admin' | 'member';
    active: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
