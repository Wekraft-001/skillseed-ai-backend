import { IsString, IsNotEmpty, IsEmail, MaxLength, IsNumber } from "class-validator";

export class CreateSchoolDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    schoolName: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    address: string;

    @IsString()
    @IsNotEmpty()
    logoUrl: string;

    @IsNumber()
    @IsNotEmpty()
    phoneNumber: number;
}