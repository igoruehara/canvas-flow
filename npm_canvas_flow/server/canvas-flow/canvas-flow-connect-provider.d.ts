import { Connection } from 'mongoose';
export declare const connectProviders: ({
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
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
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
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
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
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
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
} | {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
        name: string;
        config: any;
        releases: any[];
        latestRelease: number;
        organizationId?: string;
        createdBy?: string;
        agentId?: string;
        sortOrder?: number;
        activeRelease?: number;
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
        name: string;
        config: any;
        releases: any[];
        latestRelease: number;
        organizationId?: string;
        createdBy?: string;
        agentId?: string;
        sortOrder?: number;
        activeRelease?: number;
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
        name: string;
        config: any;
        releases: any[];
        latestRelease: number;
        organizationId?: string;
        createdBy?: string;
        agentId?: string;
        sortOrder?: number;
        activeRelease?: number;
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
        name: string;
        config: any;
        releases: any[];
        latestRelease: number;
        organizationId?: string;
        createdBy?: string;
        agentId?: string;
        sortOrder?: number;
        activeRelease?: number;
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
        name: string;
        config: any;
        releases: any[];
        latestRelease: number;
        organizationId?: string;
        createdBy?: string;
        agentId?: string;
        sortOrder?: number;
        activeRelease?: number;
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
} | {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
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
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
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
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
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
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
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
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
})[];
