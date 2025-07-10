import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';
import { User } from './users/user.schema';

export type CareerQuizDocument = CareerQuiz & Document;

@Schema({ timestamps: true, collection: 'career_quizzes' })
export class CareerQuiz {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId | User;

  @Prop({ type: [String], required: true, index: true })
  questions: string[];

  @Prop({ type: [String], index: true })
  answers: string[];

  @Prop({ type: Object, index: true })
  analysis: any;

  @Prop({ default: false, index: true })
  completed: boolean;
}

export const CareerQuizSchema = SchemaFactory.createForClass(CareerQuiz);
