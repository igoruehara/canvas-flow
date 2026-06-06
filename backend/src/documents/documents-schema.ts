import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './documents-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, default: '', index: true },
    agentId: { type: String, default: '', index: true },
    flowId: { type: String, default: '', index: true },
    conversationId: { type: String, default: '', index: true },
    rootDocumentId: { type: String, required: true, index: true },
    parentDocumentId: { type: String, default: '', index: true },
    version: { type: Number, default: 1 },
    filename: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    storage: { type: String, required: true },
    bucket: { type: String, default: '' },
    key: { type: String, required: true },
    source: { type: String, default: 'upload' },
    status: { type: String, default: 'stored' },
    text: { type: String, default: '' },
    structure: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index({ organizationId: 1, createdAt: -1 });
EntitySchema.index({ rootDocumentId: 1, version: -1 });
EntitySchema.index({ agentId: 1, flowId: 1, createdAt: -1 });
EntitySchema.index({ conversationId: 1, createdAt: -1 });

export class CanvasFlowDocumentEntity extends Document {
  documentId: string;
  organizationId: string;
  agentId: string;
  flowId: string;
  conversationId: string;
  rootDocumentId: string;
  parentDocumentId: string;
  version: number;
  filename: string;
  mimeType: string;
  size: number;
  storage: 'local' | 's3';
  bucket: string;
  key: string;
  source: 'upload' | 'url' | 'generated';
  status: string;
  text: string;
  structure: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
