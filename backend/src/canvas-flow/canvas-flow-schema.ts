import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { AGENT_COLLECTION_NAME, COLLECTION_NAME, VERSION_COLLECTION_NAME } from './canvas-flow-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    agentId: { type: String, index: true },
    organizationId: { type: String, index: true },
    description: String,
    sortOrder: { type: Number, index: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    versions: { type: [mongoose.Schema.Types.Mixed], default: undefined, select: false },
    latestVersion: { type: Number, default: 0 },
    activeVersion: { type: Number },
    createdBy: String,
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index({ organizationId: 1, agentId: 1, sortOrder: 1, updatedAt: -1 });
EntitySchema.index({ organizationId: 1, agentId: 1, 'config.channel': 1, 'config.isMainFlow': 1, updatedAt: -1 });
EntitySchema.index({ agentId: 1, 'config.channel': 1, 'config.isMainFlow': 1, updatedAt: -1 });
EntitySchema.index({ organizationId: 1, activeVersion: 1, updatedAt: -1 });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class CanvasFlowEntity extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  agentId?: string;

  @Prop()
  organizationId?: string;

  @Prop()
  description?: string;

  @Prop()
  sortOrder?: number;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  config: Record<string, any>;

  @Prop({ type: [mongoose.Schema.Types.Mixed], default: undefined, select: false })
  versions?: Array<Record<string, any>>;

  @Prop()
  latestVersion?: number;

  @Prop()
  activeVersion?: number;

  @Prop()
  createdBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const VersionSchema = new mongoose.Schema(
  {
    flowId: { type: String, required: true, index: true },
    agentId: { type: String, index: true },
    organizationId: { type: String, index: true },
    version: { type: Number, required: true, index: true },
    name: String,
    notes: String,
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    deployedAt: String,
    deployedBy: String,
    deployedByEmail: String,
    activatedAt: String,
    activatedBy: String,
    activatedByEmail: String,
    agentReleaseCandidate: Boolean,
    overwrittenAgentRelease: Number,
  },
  {
    collection: VERSION_COLLECTION_NAME,
    timestamps: true,
  },
);

VersionSchema.index({ organizationId: 1, flowId: 1, version: -1 }, { unique: true });
VersionSchema.index({ organizationId: 1, agentId: 1, version: -1 });
VersionSchema.index({ flowId: 1, version: -1 });

@Schema({
  collection: VERSION_COLLECTION_NAME,
  timestamps: true,
})
export class CanvasFlowVersionEntity extends Document {
  @Prop({ required: true })
  flowId: string;

  @Prop()
  agentId?: string;

  @Prop()
  organizationId?: string;

  @Prop({ required: true })
  version: number;

  @Prop()
  name?: string;

  @Prop()
  notes?: string;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  config: Record<string, any>;

  @Prop()
  deployedAt?: string;

  @Prop()
  deployedBy?: string;

  @Prop()
  deployedByEmail?: string;

  @Prop()
  activatedAt?: string;

  @Prop()
  activatedBy?: string;

  @Prop()
  activatedByEmail?: string;

  @Prop()
  agentReleaseCandidate?: boolean;

  @Prop()
  overwrittenAgentRelease?: number;

  createdAt: Date;
  updatedAt: Date;
}

export const AgentSchema = new mongoose.Schema(
  {
    agentId: { type: String, index: true },
    name: { type: String, required: true },
    organizationId: { type: String, index: true },
    sortOrder: { type: Number, index: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    releases: { type: [mongoose.Schema.Types.Mixed], default: [] },
    latestRelease: { type: Number, default: 0 },
    activeRelease: { type: Number },
    createdBy: String,
  },
  {
    collection: AGENT_COLLECTION_NAME,
    timestamps: true,
  },
);

AgentSchema.index({ organizationId: 1, agentId: 1 }, { unique: true, sparse: true });
AgentSchema.index({ organizationId: 1, name: 1 }, { unique: true });
AgentSchema.index({ organizationId: 1, sortOrder: 1, updatedAt: -1 });

@Schema({
  collection: AGENT_COLLECTION_NAME,
  timestamps: true,
})
export class CanvasFlowAgentEntity extends Document {
  @Prop()
  agentId?: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  organizationId?: string;

  @Prop()
  sortOrder?: number;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  config?: Record<string, any>;

  @Prop({ type: [mongoose.Schema.Types.Mixed], default: [] })
  releases?: Array<Record<string, any>>;

  @Prop()
  latestRelease?: number;

  @Prop()
  activeRelease?: number;

  @Prop()
  createdBy?: string;

  createdAt: Date;
  updatedAt: Date;
}
