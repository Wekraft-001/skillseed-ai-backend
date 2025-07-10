import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './users/user.schema';
import { UserRole } from 'src/common/interfaces';
import { Type } from '@nestjs/common';

@Schema({ timestamps: true })
export class School extends Document {
  @Prop({ required: true, index: true })
  schoolName: string;

  @Prop({ index: true })
  schoolType: string;

  @Prop({ index: true })
  schoolContactPerson: string;

  @Prop({ index: true })
  email: string;

  @Prop({ index: true })
  address: string;

  @Prop({ index: true })
  city: string;

  @Prop({ index: true })
  country: string;

  @Prop({ index: true })
  phoneNumber: string;

  @Prop({ index: true })
  logoUrl?: string;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.SCHOOL_ADMIN,
    index: true,
  })
  role?: string;

  @Prop({ index: true })
  password?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], index: true })
  students: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  superAdmin: User;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  createdBy?: Types.ObjectId;

  @Prop({ default: null, index: true })
  deletedAt: Date;
}

export const SchoolSchema = SchemaFactory.createForClass(School);
