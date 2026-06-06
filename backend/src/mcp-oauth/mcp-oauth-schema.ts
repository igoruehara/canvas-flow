import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './mcp-oauth-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    connectionScope: { type: String, enum: ['agent', 'user'], default: 'agent', index: true },
    oauthUserId: { type: String, index: true },
    serverUrl: { type: String, required: true },
    serverUrlHash: { type: String, required: true, index: true },
    label: String,
    scope: String,
    redirectUrl: String,
    state: { type: String, index: true },
    authorizationUrl: String,
    status: { type: String, enum: ['pending', 'connected', 'error'], default: 'pending', index: true },
    error: String,
    clientMetadata: { type: mongoose.Schema.Types.Mixed },
    clientInformation: String,
    tokens: String,
    codeVerifier: String,
    discoveryState: String,
    expiresAt: Date,
    authenticatedAt: Date,
    createdBy: String,
    updatedBy: String,
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index(
  { organizationId: 1, agentId: 1, connectionScope: 1, oauthUserId: 1, serverUrlHash: 1 },
  { name: 'mcp_oauth_scope_lookup' },
);
EntitySchema.index({ state: 1 }, { sparse: true });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class CanvasMcpOAuthConnectionEntity extends Document {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop()
  organizationId?: string;

  @Prop()
  agentId?: string;

  @Prop({ default: 'agent' })
  connectionScope?: 'agent' | 'user';

  @Prop()
  oauthUserId?: string;

  @Prop({ required: true })
  serverUrl: string;

  @Prop({ required: true })
  serverUrlHash: string;

  @Prop()
  label?: string;

  @Prop()
  scope?: string;

  @Prop()
  redirectUrl?: string;

  @Prop()
  state?: string;

  @Prop()
  authorizationUrl?: string;

  @Prop({ default: 'pending' })
  status: 'pending' | 'connected' | 'error';

  @Prop()
  error?: string;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  clientMetadata?: Record<string, any>;

  @Prop()
  clientInformation?: string;

  @Prop()
  tokens?: string;

  @Prop()
  codeVerifier?: string;

  @Prop()
  discoveryState?: string;

  @Prop()
  expiresAt?: Date;

  @Prop()
  authenticatedAt?: Date;

  @Prop()
  createdBy?: string;

  @Prop()
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}
