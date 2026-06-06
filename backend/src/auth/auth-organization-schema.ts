import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { ORGANIZATION_COLLECTION_NAME } from './auth-constants-model';

export const OrganizationEntitySchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    active: { type: Boolean, default: true, index: true },
    ownerUserId: { type: String },
    createdByEmail: { type: String, lowercase: true, trim: true },
  },
  {
    collection: ORGANIZATION_COLLECTION_NAME,
    timestamps: true,
  },
);

OrganizationEntitySchema.index({ slug: 1 }, { unique: true });

@Schema({
  collection: ORGANIZATION_COLLECTION_NAME,
  timestamps: true,
})
export class CanvasFlowOrganizationEntity extends Document {
  @Prop({ required: true })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  slug: string;

  @Prop({ default: true })
  active: boolean;

  @Prop()
  ownerUserId?: string;

  @Prop()
  createdByEmail?: string;

  createdAt: Date;
  updatedAt: Date;
}
