import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: {
        createdAt: true;
        updatedAt: false;
    };
}, {
    role: string;
    content: string;
    conversationId: string;
    metadata: any;
    agentId?: string;
    createdAt: NativeDate;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    role: string;
    content: string;
    conversationId: string;
    metadata: any;
    agentId?: string;
    createdAt: NativeDate;
}>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: {
        createdAt: true;
        updatedAt: false;
    };
}>> & mongoose.FlatRecord<{
    role: string;
    content: string;
    conversationId: string;
    metadata: any;
    agentId?: string;
    createdAt: NativeDate;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class MemoryTurnEntity extends Document {
    agentId?: string;
    conversationId: string;
    role: string;
    content: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}
