import { Connection } from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';
import {
  COLLECTION_NAME,
  HISTORY_COLLECTION_NAME,
  HISTORY_MODEL_NAME,
  MODEL_NAME,
  TRACE_HISTORY_COLLECTION_NAME,
  TRACE_HISTORY_MODEL_NAME,
} from './memory-constants-model';
import { HistoryEntitySchema } from './memory-history-schema';
import { EntitySchema } from './memory-schema';
import { TraceHistoryEntitySchema } from './memory-trace-history-schema';

export const connectProviders = [
  {
    provide: MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(COLLECTION_NAME, EntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
  {
    provide: HISTORY_MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(HISTORY_COLLECTION_NAME, HistoryEntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
  {
    provide: TRACE_HISTORY_MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(TRACE_HISTORY_COLLECTION_NAME, TraceHistoryEntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
];
