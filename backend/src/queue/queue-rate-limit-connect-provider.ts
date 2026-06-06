import { Connection } from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';
import { COLLECTION_NAME, MODEL_NAME } from './queue-rate-limit-constants-model';
import { EntitySchema } from './queue-rate-limit-schema';

export const rateLimitConnectProviders = [
  {
    provide: MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(COLLECTION_NAME, EntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
];
