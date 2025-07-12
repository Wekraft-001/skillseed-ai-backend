import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "./users/user.schema";
import { UserRole } from "src/common/interfaces";

@Schema({timestamps: true})
export class Mentor extends Document {
    @Prop({required: true, index: true})
    firstName: string;

    @Prop({required: true, index: true})
    lastName: string;
}