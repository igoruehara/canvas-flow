import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    key: string;
    organizationId: string;
    text: string;
    version: number;
    agentId: string;
    flowId: string;
    source: string;
    conversationId: string;
    metadata: any;
    size: number;
    status: string;
    documentId: string;
    rootDocumentId: string;
    parentDocumentId: string;
    filename: string;
    mimeType: string;
    storage: string;
    bucket: string;
    structure: any;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    key: string;
    organizationId: string;
    text: string;
    version: number;
    agentId: string;
    flowId: string;
    source: string;
    conversationId: string;
    metadata: any;
    size: number;
    status: string;
    documentId: string;
    rootDocumentId: string;
    parentDocumentId: string;
    filename: string;
    mimeType: string;
    storage: string;
    bucket: string;
    structure: any;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    key: string;
    organizationId: string;
    text: string;
    version: number;
    agentId: string;
    flowId: string;
    source: string;
    conversationId: string;
    metadata: any;
    size: number;
    status: string;
    documentId: string;
    rootDocumentId: string;
    parentDocumentId: string;
    filename: string;
    mimeType: string;
    storage: string;
    bucket: string;
    structure: any;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class CanvasFlowDocumentEntity extends Document {
    documentId: string;
    organizationId: string;
    agentId: string;
    flowId: string;
    conversationId: string;
    rootDocumentId: string;
    parentDocumentId: string;
    version: number;
    filename: string;
    mimeType: string;
    size: number;
    storage: 'local' | 's3';
    bucket: string;
    key: string;
    source: 'upload' | 'url' | 'generated';
    status: string;
    text: string;
    structure: Record<string, any>;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
