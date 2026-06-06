import { Connection } from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';
import { AGENT_COLLECTION_NAME, AGENT_MODEL_NAME, COLLECTION_NAME, MODEL_NAME, VERSION_COLLECTION_NAME, VERSION_MODEL_NAME } from './canvas-flow-constants-model';
import { AgentSchema, EntitySchema, VersionSchema } from './canvas-flow-schema';

export const connectProviders = [
  {
    provide: MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(COLLECTION_NAME, EntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
  {
    provide: AGENT_MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(AGENT_COLLECTION_NAME, AgentSchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
  {
    provide: VERSION_MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(VERSION_COLLECTION_NAME, VersionSchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
];
