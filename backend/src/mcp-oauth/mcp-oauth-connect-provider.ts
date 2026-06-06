import { Connection } from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';
import { COLLECTION_NAME, MODEL_NAME } from './mcp-oauth-constants-model';
import { EntitySchema } from './mcp-oauth-schema';

export const connectProviders = [
  {
    provide: MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(COLLECTION_NAME, EntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
];
