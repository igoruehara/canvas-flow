import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { TRACE_HISTORY_COLLECTION_NAME } from './memory-constants-model';

export const TraceHistoryEntitySchema = new mongoose.Schema(
  {
    agentId: { type: String, index: true },
    conversationId: { type: String, required: true, index: true },
    role: { type: String, required: true },
    content: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    collection: TRACE_HISTORY_COLLECTION_NAME,
    timestamps: { createdAt: true, updatedAt: false },
  },
);

TraceHistoryEntitySchema.index({ agentId: 1, conversationId: 1, createdAt: -1 });
TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.kind': 1, createdAt: -1 });
TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, agentId: 1, conversationId: 1, 'metadata.kind': 1, createdAt: -1 });
TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.flowId': 1, 'metadata.kind': 1, createdAt: -1 });
TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.entryFlowId': 1, 'metadata.kind': 1, createdAt: -1 });
TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.activeFlowId': 1, 'metadata.kind': 1, createdAt: -1 });

@Schema({
  collection: TRACE_HISTORY_COLLECTION_NAME,
  timestamps: { createdAt: true, updatedAt: false },
})
export class TraceHistoryEntity extends Document {
  @Prop()
  agentId?: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true })
  role: string;

  @Prop()
  content: string;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;

  createdAt: Date;
}
