import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './users/user.schema';

export type EducationalContentDocument = EducationalContent & Document;

@Schema({ timestamps: true })
export class EducationalContent {
  @Prop({
    type: [{ title: String, url: String }],
    default: [],
    index: true
  })
  videoUrl: { title: string; url: string }[];

  @Prop({
    type: [
      {
        title: String,
        author: String,
        level: String,
        theme: String,
      },
    ],
    default: [],
    index: true
  })
  books: Array<{
    title: string;
    author: string;
    level: string;
    theme: string;
  }>;

  @Prop({
    type: [
      {
        name: String,
        url: String,
        skill: String,
      },
    ],
    default: [],
    index: true
  })
  games: Array<{
    name: string;
    url: string;
    skill: string;
  }>;

  @Prop({ enum: ['video', 'book', 'game'], required: false, index: true })
  contentType?: 'video' | 'book' | 'game';

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user: Types.ObjectId | User;
}

export const EducationalContentSchema =
  SchemaFactory.createForClass(EducationalContent);
