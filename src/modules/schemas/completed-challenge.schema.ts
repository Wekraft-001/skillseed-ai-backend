import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CompletedChallengeDocument = CompletedChallenge & Document;

@Schema({ timestamps: true })
export class CompletedChallenge {
  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  })
  userId: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Challenge', 
    required: true, 
    index: true 
  })
  challengeId: Types.ObjectId;

  @Prop({ required: false })
  completionNotes?: string;

  @Prop({ required: false })
  workFileUrl?: string;

  @Prop({ default: Date.now })
  completedAt: Date;
}

export const CompletedChallengeSchema = SchemaFactory.createForClass(CompletedChallenge);

// Create a compound index for userId and challengeId to ensure uniqueness
CompletedChallengeSchema.index({ userId: 1, challengeId: 1 }, { unique: true });