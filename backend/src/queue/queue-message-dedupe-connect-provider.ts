import { Connection } from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';
import { COLLECTION_NAME, MODEL_NAME } from './queue-message-dedupe-constants-model';
import { EntitySchema } from './queue-message-dedupe-schema';

export const messageDedupeConnectProviders = [
  {
    provide: MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(COLLECTION_NAME, EntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
];
