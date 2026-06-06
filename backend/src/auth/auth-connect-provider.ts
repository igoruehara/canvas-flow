import { Connection } from 'mongoose';
import { STRING_URL_DATABASE_CONNECTION } from './../constants-global';
import { COLLECTION_NAME, MODEL_NAME, ORGANIZATION_COLLECTION_NAME, ORGANIZATION_MODEL_NAME } from './auth-constants-model';
import { OrganizationEntitySchema } from './auth-organization-schema';
import { EntitySchema } from './auth-schema';

export const connectProviders = [
  {
    provide: MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(COLLECTION_NAME, EntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
  {
    provide: ORGANIZATION_MODEL_NAME,
    useFactory: (connection: Connection) => connection.model(ORGANIZATION_COLLECTION_NAME, OrganizationEntitySchema),
    inject: [STRING_URL_DATABASE_CONNECTION],
  },
];
