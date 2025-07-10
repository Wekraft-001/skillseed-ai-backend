import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from 'src/common/interfaces';
import { School } from '../school.schema';

export type UserDocument = User &
  Document & {
    _id: Types.ObjectId;
    school: Types.ObjectId;
    createdBy: Types.ObjectId;
  };

@Schema({ timestamps: true, collection: 'users', autoIndex: true })
export class User extends Document {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  firstName: string;

  @Prop({ required: true, index: true })
  lastName: string;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.STUDENT,
    index: true
  })
  role: UserRole;

  @Prop({ required: false, index: true })
  image?: string;

  @Prop({ required: false, index: true })
  grade?: string;

  @Prop({ required: false, index: true })
  age: number;

  @Prop({sparse: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, minlength: 6 })
  password: string;

  @Prop({ default: null })
  deletedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'School', index: true, default: null })
  school: Types.ObjectId;

  @Prop({type: Types.ObjectId, ref: 'User', default: null, index: true})
  createdBy?: Types.ObjectId;

  quizzes?: Types.ObjectId[];
  badges: Types.ObjectId[];
  educationalContents: Types.ObjectId[];
  showcases: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('userQuizzes', {
  ref: 'CareerQuiz',
  localField: '_id',
  foreignField: 'user',
});

UserSchema.virtual('userBadges', {
  ref: 'Badge',
  localField: '_id',
  foreignField: 'user',
});

UserSchema.virtual('userEducationalContents', {
  ref: 'EducationalContent',
  localField: '_id',
  foreignField: 'user',
});

UserSchema.virtual('userShowcases', {
  ref: 'ProjectShowcase',
  localField: '_id',
  foreignField: 'user',
});

UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });
