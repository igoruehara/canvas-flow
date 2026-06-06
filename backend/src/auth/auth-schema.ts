import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './auth-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    organizationName: { type: String, required: true },
    organizationSlug: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    active: { type: Boolean, default: true, index: true },
    lastLoginAt: Date,
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index({ organizationSlug: 1, email: 1 }, { unique: true });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class CanvasFlowUserEntity extends Document {
  @Prop({ required: true })
  organizationId: string;

  @Prop({ required: true })
  organizationName: string;

  @Prop({ required: true })
  organizationSlug: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ default: 'member' })
  role: 'owner' | 'admin' | 'member';

  @Prop({ default: true })
  active: boolean;

  @Prop()
  lastLoginAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
