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

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        questions: [
          {
            text: { text: String, required: true },
            answers: [{ type: String, required: true }],
          },
        ],
        funBreak: { type: String, required: true },
      },
    ],
    required: true,
  })
  phases: {
    name: string;
    questions: {
      text: string;
      answers: string[];
    }[];
    funBreak: string;
  }[];

  @Prop({
    type: [
      {
        phaseIndex: { type: Number, required: true },
        questionIndex: { type: Number, required: true },
        answer: { type: String },
      },
    ],
    default: [],
  })
  userAnswers: { phaseIndex: number; questionIndex: number; answer: string }[];

  // @Prop({ type: [String], index: true })
  // answers: string[];
  @Prop({ type: Object, index: true })
  analysis: any;

  @Prop({ required: true, index: true })
  ageRange: string;

  @Prop({ default: false, index: true })
  completed: boolean;
}

export const CareerQuizSchema = SchemaFactory.createForClass(CareerQuiz);
