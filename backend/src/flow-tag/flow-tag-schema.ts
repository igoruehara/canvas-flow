import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './flow-tag-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    flowId: { type: String, index: true },
    flowName: String,
    entryFlowId: { type: String, index: true },
    activeFlowId: { type: String, index: true },
    conversationId: { type: String, required: true, index: true },
    channel: { type: String, index: true },
    stepId: { type: String, index: true },
    stepTitle: String,
    stepType: String,
    tag: { type: String, required: true, index: true },
    label: String,
    mode: { type: String, enum: ['once', 'always'], default: 'always', index: true },
    value: mongoose.Schema.Types.Mixed,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    input: String,
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: true, updatedAt: false },
  },
);

EntitySchema.index({ organizationId: 1, createdAt: -1 });
EntitySchema.index({ agentId: 1, flowId: 1, createdAt: -1 });
EntitySchema.index({ conversationId: 1, createdAt: -1 });
EntitySchema.index({ tag: 1, createdAt: -1 });
EntitySchema.index({ organizationId: 1, tag: 1, createdAt: -1 });
EntitySchema.index({ organizationId: 1, agentId: 1, tag: 1, createdAt: -1 });
EntitySchema.index({ organizationId: 1, conversationId: 1, createdAt: -1 });
EntitySchema.index({ organizationId: 1, flowId: 1, tag: 1, createdAt: -1 });
EntitySchema.index({ organizationId: 1, entryFlowId: 1, tag: 1, createdAt: -1 });
EntitySchema.index({ organizationId: 1, activeFlowId: 1, tag: 1, createdAt: -1 });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: { createdAt: true, updatedAt: false },
})
export class FlowTagEventEntity extends Document {
  @Prop()
  organizationId?: string;

  @Prop()
  agentId?: string;

  @Prop()
  flowId?: string;

  @Prop()
  flowName?: string;

  @Prop()
  entryFlowId?: string;

  @Prop()
  activeFlowId?: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop()
  channel?: string;

  @Prop()
  stepId?: string;

  @Prop()
  stepTitle?: string;

  @Prop()
  stepType?: string;

  @Prop({ required: true })
  tag: string;

  @Prop()
  label?: string;

  @Prop()
  mode?: 'once' | 'always';

  @Prop({ type: mongoose.Schema.Types.Mixed })
  value?: any;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;

  @Prop()
  input?: string;

  @Prop()
  idempotencyKey?: string;

  createdAt: Date;
}
