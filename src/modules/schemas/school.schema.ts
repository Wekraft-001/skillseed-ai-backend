import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './users/user.schema';

@Schema({ timestamps: true })
export class School extends Document {
  @Prop({ required: true })
  schoolName: string;

  @Prop()
  schoolType: string;

  @Prop()
  schoolContactPerson: string;

  @Prop()
  email: string;

  @Prop()
  address: string;

  @Prop()
  city: string;

  @Prop()
  country: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  role?: string;

  @Prop()
  password?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  users: User[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  superAdmin: User;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: User;

  @Prop({ default: null })
  deletedAt: Date;
}

export const SchoolSchema = SchemaFactory.createForClass(School);
