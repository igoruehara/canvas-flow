import { Connection } from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';
import { COLLECTION_NAME, MODEL_NAME } from './flow-tag-constants-model';
import { EntitySchema } from './flow-tag-schema';

export const connectProviders = [
  {
    provide: MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(COLLECTION_NAME, EntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
];
