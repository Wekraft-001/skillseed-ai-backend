import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './users/user.schema';

@Schema({ timestamps: true })
export class School extends Document {
  @Prop({ required: true, index: true })
  schoolName: string;

  @Prop({ index: true })
  schoolType: string;

  @Prop({index: true})
  schoolContactPerson: string;

  @Prop({index: true})
  email: string;

  @Prop({index: true})
  address: string;

  @Prop({index: true})
  city: string;

  @Prop({index: true})
  country: string;

  @Prop({index: true})
  phoneNumber: string;

  @Prop({index: true})
  logoUrl?: string;

  @Prop({index: true})
  role?: string;

  @Prop({index: true})
  password?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], index: true })
  users: User[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  superAdmin: User;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  createdBy?: User;

  @Prop({ default: null, index: true })
  deletedAt: Date;
}

export const SchoolSchema = SchemaFactory.createForClass(School);
