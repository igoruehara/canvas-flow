import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './queue-message-dedupe-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing', index: true },
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    flowId: { type: String, index: true },
    conversationId: { type: String, index: true },
    channel: { type: String, index: true },
    provider: { type: String, index: true },
    providerMessageId: { type: String, index: true },
    attempts: { type: Number, default: 1 },
    error: String,
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    failedAt: Date,
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EntitySchema.index({ organizationId: 1, provider: 1, providerMessageId: 1 });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class QueueMessageDedupeEntity extends Document {
  @Prop({ required: true, unique: true, index: true })
  dedupeKey: string;

  @Prop({ default: 'processing', index: true })
  status: 'processing' | 'completed' | 'failed';

  @Prop()
  organizationId?: string;

  @Prop()
  agentId?: string;

  @Prop()
  flowId?: string;

  @Prop()
  conversationId?: string;

  @Prop()
  channel?: string;

  @Prop()
  provider?: string;

  @Prop()
  providerMessageId?: string;

  @Prop({ default: 1 })
  attempts?: number;

  @Prop()
  error?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}
