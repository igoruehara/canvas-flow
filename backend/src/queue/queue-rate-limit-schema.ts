import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './queue-rate-limit-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    bucketKey: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    limit: { type: Number, default: 0 },
    windowStartedAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  },
);

EntitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({
  collection: COLLECTION_NAME,
  timestamps: true,
})
export class QueueRateLimitEntity extends Document {
  @Prop({ required: true, unique: true, index: true })
  bucketKey: string;

  @Prop({ default: 0 })
  count: number;

  @Prop({ default: 0 })
  limit: number;

  @Prop({ required: true, index: true })
  windowStartedAt: Date;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}
