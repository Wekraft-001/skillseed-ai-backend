import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "./users/user.schema";
import { PaymentMethod } from "src/common/interfaces";
import { transactionType } from "src/common/interfaces/transaction-type.enum";

@Schema({ timestamps: true })
export class Transaction {

    @Prop({ required: true, index: true })
    schoolName: string;

    @Prop({required: true, index: true})
    amount: number;

    @Prop({required: true, index: true})
    numberOfKids: number;

    @Prop({enum: PaymentMethod, required: true, index: true, default: PaymentMethod.MOBILE_MONEY})
    paymentMethod: PaymentMethod;

    @Prop({ enum: transactionType, required: true, index: true, default: transactionType.SUBSCRIPTION})
    transactionType: transactionType;

    @Prop({required: true})
    transactionDate: Date;

    @Prop()
    notes: string;

    @Prop({type: Types.ObjectId, ref: 'School', index: true})
    school: Types.ObjectId;

}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
export type TransactionDocument = Transaction & Document;