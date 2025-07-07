// import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
// import { Document, Types } from "mongoose";
// import { User } from "./users/user.schema";

// export type SchoolDocument = School & Document;

// @Schema({ timestamps: true, collection: 'schools' })
// export class School {
//     // @PrimaryGeneratedColumn()
//     // id: number;

//     @Prop({ required: true})
//     schoolName: string;

//     @Prop({ required: true, unique: true, lowercase: true, trim: true })
//     email: string;

//     @Prop()
//     address: string;

//     @Prop()
//     logoUrl: string;

//     @Prop()
//     phoneNumber: number;

//     @Prop({type: [{ type: Types.ObjectId, ref: 'User'}]})
//     users: User[];

//     @Prop({ type: Types.ObjectId, ref: 'User' })
//     admin: User;

//     @Prop({ type: Types.ObjectId, ref: 'User' })
//     superAdmin: User;

//     @Prop({ default: null })
//     deletedAt: Date | null;

// }

// export const SchoolSchema = SchemaFactory.createForClass(School);

// school.schema.ts
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

  @Prop({type: Types.ObjectId, ref: 'User'})
  users: User[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  superAdmin: User; 

  @Prop({type: Types.ObjectId, ref: 'User'})
  createdBy?: User;
}

export const SchoolSchema = SchemaFactory.createForClass(School);
