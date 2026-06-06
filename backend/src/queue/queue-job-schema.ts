import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './queue-job-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    flowId: { type: String, index: true },
    conversationId: { type: String, index: true },
    messageId: String,
    payload: { type: mongoose.Schema.Types.Mixed },
    result: { type: mongoose.Schema.Types.Mixed },
    error: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    queuedAt: { type: Date, default: Date.now, index: true },
    startedAt: Date,
    completedAt: Date,
    failedAt: Date,
    expiresAt: { type: Date, index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index({ organizationId: 1, jobId: 1 });
EntitySchema.index({ organizationId: 1, agentId: 1, conversationId: 1, queuedAt: -1 });
EntitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class QueueJobEntity extends Document {
  @Prop({ required: true, unique: true, index: true })
  jobId: string;

  @Prop({ required: true, index: true })
  type: string;

  @Prop({ default: 'queued', index: true })
  status: 'queued' | 'running' | 'completed' | 'failed';

  @Prop()
  organizationId?: string;

  @Prop()
  agentId?: string;

  @Prop()
  flowId?: string;

  @Prop()
  conversationId?: string;

  @Prop()
  messageId?: string;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  payload?: Record<string, any>;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  result?: Record<string, any>;

  @Prop()
  error?: string;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;

  @Prop()
  queuedAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
