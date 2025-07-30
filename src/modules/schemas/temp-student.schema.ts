import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from 'src/common/interfaces';

@Schema({ timestamps: true })
export class TempStudent extends Document {
  @Prop({ required: true })
  childTempId: string;
  
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;
  
  @Prop()
  age: number;

  @Prop({required: true})
  role: UserRole.STUDENT

  @Prop()
  grade: string;

  @Prop()
  imageUrl: string;

  @Prop()
  password: string;

  @Prop()
  paymentUrl: string;
}

export const TempStudentSchema = SchemaFactory.createForClass(TempStudent);

TempStudentSchema.index({createdAt: 1}, { expireAfterSeconds: 3600});