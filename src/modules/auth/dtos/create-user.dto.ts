import { IsString, IsEmail, MinLength, IsNumber } from "class-validator";
import { UserRole } from "src/common/interfaces";

export class CreateUserDto {
    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsEmail()
    email: string;

    @IsNumber()
    age: number;

    @IsString()
    role?: UserRole;

    @IsString()
    @MinLength(6)
    password: string;
}