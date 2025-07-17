// src/subscription/subscription.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './users/user.schema';
import { SubscriptionStatus } from 'src/common/interfaces';

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'RWF' })
  currency: string;

  @Prop({ required: true, unique: true })
  transactionRef: string;

  @Prop({ default: null })
  flutterwaveTransactionId: string;

  @Prop()
  flutterwaveCardToken?: string;

  @Prop({ enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: 30 })
  maxChildren: number;

  @Prop({ default: 0 })
  childrenCount: number;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ type: Object, default: null })
  paymentData: any;

  @Prop({ default: null })
  deletedAt: Date;
}

export type SubscriptionDocument = Subscription & Document;
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);