import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './users/user.schema';
import { ProjectShowcase } from './showcase.schema';

export type BadgeDocument = Badge & Document;

@Schema({ timestamps: true })
export class Badge {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  imageUrl: string;

  @Prop({
    type: [
      {
        description: String,
        isCompleted: Boolean,
      },
    ],
    required: true,
  })
  tasks: {
    description: string;
    isCompleted: boolean;
  }[];

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'ProjectShowcase' })
  showcase: ProjectShowcase;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;
}

export const BadgeSchema = SchemaFactory.createForClass(Badge);
