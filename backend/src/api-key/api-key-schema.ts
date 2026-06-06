import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './api-key-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    tokenPrefix: { type: String, required: true },
    flowId: { type: String, index: true },
    agentId: { type: String, index: true },
    organizationId: { type: String, index: true },
    scopes: { type: [String], default: ['run:flow'] },
    active: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date },
    totalUses: { type: Number, default: 0 },
    createdBy: String,
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index({ flowId: 1, active: 1, createdAt: -1 });
EntitySchema.index({ agentId: 1, active: 1, createdAt: -1 });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class CanvasFlowApiKeyEntity extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, select: false })
  tokenHash: string;

  @Prop({ required: true })
  tokenPrefix: string;

  @Prop()
  flowId?: string;

  @Prop()
  agentId?: string;

  @Prop()
  organizationId?: string;

  @Prop({ type: [String], default: ['run:flow'] })
  scopes: string[];

  @Prop({ default: true })
  active: boolean;

  @Prop()
  expiresAt?: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  lastUsedAt?: Date;

  @Prop({ default: 0 })
  totalUses: number;

  @Prop()
  createdBy?: string;

  createdAt: Date;
  updatedAt: Date;
}
