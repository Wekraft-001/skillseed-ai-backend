import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Badge } from './badges.schema';
import { User } from './users/user.schema';
import { UserRole } from 'src/common/interfaces';

// Embedded feedback schema
@Schema({ _id: false })
export class Feedback {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: UserRole, required: true })
  role: UserRole;

  @Prop({ required: true })
  comment: string;

  @Prop({ default: Date.now })
  timestamp: Date;
}

const FeedbackSchema = SchemaFactory.createForClass(Feedback);

@Schema({ timestamps: true })
export class ProjectShowcase extends Document {
  @Prop({ required: true })
  projectName: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Badge' })
  badge: Types.ObjectId | Badge;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId | User;

  @Prop({ type: [FeedbackSchema], default: [] })
  feedback: Feedback[];

  @Prop({ required: true })
  imageUrl: string;
}

export const ProjectShowcaseSchema =
  SchemaFactory.createForClass(ProjectShowcase);
