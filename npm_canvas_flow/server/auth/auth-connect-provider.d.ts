import { Connection } from 'mongoose';
export declare const connectProviders: ({
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
        organizationId: string;
        name: string;
        active: boolean;
        organizationName: string;
        organizationSlug: string;
        email: string;
        passwordHash: string;
        role: "owner" | "admin" | "member";
        lastLoginAt?: NativeDate;
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
        organizationId: string;
        name: string;
        active: boolean;
        organizationName: string;
        organizationSlug: string;
        email: string;
        passwordHash: string;
        role: "owner" | "admin" | "member";
        lastLoginAt?: NativeDate;
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
        organizationId: string;
        name: string;
        active: boolean;
        organizationName: string;
        organizationSlug: string;
        email: string;
        passwordHash: string;
        role: "owner" | "admin" | "member";
        lastLoginAt?: NativeDate;
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
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
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
        organizationId: string;
        name: string;
        active: boolean;
        organizationName: string;
        organizationSlug: string;
        email: string;
        passwordHash: string;
        role: "owner" | "admin" | "member";
        lastLoginAt?: NativeDate;
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
        organizationId: string;
        name: string;
        active: boolean;
        organizationName: string;
        organizationSlug: string;
        email: string;
        passwordHash: string;
        role: "owner" | "admin" | "member";
        lastLoginAt?: NativeDate;
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
} | {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
        organizationId: string;
        name: string;
        slug: string;
        active: boolean;
        ownerUserId?: string;
        createdByEmail?: string;
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
        organizationId: string;
        name: string;
        slug: string;
        active: boolean;
        ownerUserId?: string;
        createdByEmail?: string;
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
        organizationId: string;
        name: string;
        slug: string;
        active: boolean;
        ownerUserId?: string;
        createdByEmail?: string;
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
        collection: string;
        timestamps: true;
    }, {
        organizationId: string;
        name: string;
        slug: string;
        active: boolean;
        ownerUserId?: string;
        createdByEmail?: string;
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
        organizationId: string;
        name: string;
        slug: string;
        active: boolean;
        ownerUserId?: string;
        createdByEmail?: string;
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
        organizationId: string;
        name: string;
        slug: string;
        active: boolean;
        ownerUserId?: string;
        createdByEmail?: string;
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
})[];
