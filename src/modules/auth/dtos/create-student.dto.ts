import { IsString, IsEmail, MinLength } from "class-validator";

export class CreateStudentDto {
    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;
}