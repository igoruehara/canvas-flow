import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
export declare const EntitySchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    name: string;
    config: any;
    latestVersion: number;
    organizationId?: string;
    description?: string;
    createdBy?: string;
    agentId?: string;
    sortOrder?: number;
    versions?: any[];
    activeVersion?: number;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    name: string;
    config: any;
    latestVersion: number;
    organizationId?: string;
    description?: string;
    createdBy?: string;
    agentId?: string;
    sortOrder?: number;
    versions?: any[];
    activeVersion?: number;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    name: string;
    config: any;
    latestVersion: number;
    organizationId?: string;
    description?: string;
    createdBy?: string;
    agentId?: string;
    sortOrder?: number;
    versions?: any[];
    activeVersion?: number;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class CanvasFlowEntity extends Document {
    name: string;
    agentId?: string;
    organizationId?: string;
    description?: string;
    sortOrder?: number;
    config: Record<string, any>;
    versions?: Array<Record<string, any>>;
    latestVersion?: number;
    activeVersion?: number;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const VersionSchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    version: number;
    config: any;
    flowId: string;
    organizationId?: string;
    name?: string;
    agentId?: string;
    notes?: string;
    deployedAt?: string;
    deployedBy?: string;
    deployedByEmail?: string;
    activatedAt?: string;
    activatedBy?: string;
    activatedByEmail?: string;
    agentReleaseCandidate?: boolean;
    overwrittenAgentRelease?: number;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    version: number;
    config: any;
    flowId: string;
    organizationId?: string;
    name?: string;
    agentId?: string;
    notes?: string;
    deployedAt?: string;
    deployedBy?: string;
    deployedByEmail?: string;
    activatedAt?: string;
    activatedBy?: string;
    activatedByEmail?: string;
    agentReleaseCandidate?: boolean;
    overwrittenAgentRelease?: number;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    version: number;
    config: any;
    flowId: string;
    organizationId?: string;
    name?: string;
    agentId?: string;
    notes?: string;
    deployedAt?: string;
    deployedBy?: string;
    deployedByEmail?: string;
    activatedAt?: string;
    activatedBy?: string;
    activatedByEmail?: string;
    agentReleaseCandidate?: boolean;
    overwrittenAgentRelease?: number;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class CanvasFlowVersionEntity extends Document {
    flowId: string;
    agentId?: string;
    organizationId?: string;
    version: number;
    name?: string;
    notes?: string;
    config: Record<string, any>;
    deployedAt?: string;
    deployedBy?: string;
    deployedByEmail?: string;
    activatedAt?: string;
    activatedBy?: string;
    activatedByEmail?: string;
    agentReleaseCandidate?: boolean;
    overwrittenAgentRelease?: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AgentSchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    collection: string;
    timestamps: true;
}, {
    name: string;
    config: any;
    releases: any[];
    latestRelease: number;
    organizationId?: string;
    createdBy?: string;
    agentId?: string;
    sortOrder?: number;
    activeRelease?: number;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    name: string;
    config: any;
    releases: any[];
    latestRelease: number;
    organizationId?: string;
    createdBy?: string;
    agentId?: string;
    sortOrder?: number;
    activeRelease?: number;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    collection: string;
    timestamps: true;
}>> & mongoose.FlatRecord<{
    name: string;
    config: any;
    releases: any[];
    latestRelease: number;
    organizationId?: string;
    createdBy?: string;
    agentId?: string;
    sortOrder?: number;
    activeRelease?: number;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export declare class CanvasFlowAgentEntity extends Document {
    agentId?: string;
    name: string;
    organizationId?: string;
    sortOrder?: number;
    config?: Record<string, any>;
    releases?: Array<Record<string, any>>;
    latestRelease?: number;
    activeRelease?: number;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
