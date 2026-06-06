import { Connection } from 'mongoose';
export declare const connectProviders: {
    provide: string;
    useFactory: (connection: Connection) => import("mongoose").Model<{
        key: string;
        settings: any;
        updatedBy?: string;
    } & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
        key: string;
        settings: any;
        updatedBy?: string;
    } & import("mongoose").DefaultTimestampProps, {}, {}> & {
        key: string;
        settings: any;
        updatedBy?: string;
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
        collection: string;
        timestamps: true;
    }, {
        key: string;
        settings: any;
        updatedBy?: string;
    } & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
        key: string;
        settings: any;
        updatedBy?: string;
    } & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
        collection: string;
        timestamps: true;
    }>> & import("mongoose").FlatRecord<{
        key: string;
        settings: any;
        updatedBy?: string;
    } & import("mongoose").DefaultTimestampProps> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>>;
    inject: string[];
}[];
