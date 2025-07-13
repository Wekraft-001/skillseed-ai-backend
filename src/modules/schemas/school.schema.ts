import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './users/user.schema';
import { PaymentStatus, UserRole } from 'src/common/interfaces';

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

  @Prop({ index: true, default: null})
  studentsLimit: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], index: true })
  students: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  superAdmin?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Transaction', index: true})
  transactions: Types.ObjectId[];

  @Prop({enum: PaymentStatus, default: PaymentStatus.PENDING})
  status: PaymentStatus;

  @Prop({ default: null, index: true })
  deletedAt: Date;

}

export const SchoolSchema = SchemaFactory.createForClass(School);
