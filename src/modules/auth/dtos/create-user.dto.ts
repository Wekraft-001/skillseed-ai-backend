import { IsString, IsEmail, MinLength } from "class-validator";
import { UserRole } from "src/common/interfaces";

export class CreateUserDto {
    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsEmail()
    email: string;

    @IsString()
    role?: UserRole;

    @IsString()
    @MinLength(6)
    password: string;
}