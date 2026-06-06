import { Prop, Schema } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { COLLECTION_NAME } from './queue-lock-constants-model';

export const EntitySchema = new mongoose.Schema(
  {
    lockKey: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
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
export class QueueLockEntity extends Document {
  @Prop({ required: true, unique: true, index: true })
  lockKey: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}
