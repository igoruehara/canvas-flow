import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './provider-config-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    settings: { type: Object, default: {} },
    updatedBy: String,
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class ProviderConfigEntity extends Document {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ type: Object, default: {} })
  settings: Record<string, any>;

  @Prop()
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}
