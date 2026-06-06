import * as mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';
export declare const databaseProviders: {
    provide: string;
    inject: (typeof ConfigService)[];
    useFactory: (configService: ConfigService) => Promise<typeof mongoose>;
}[];
