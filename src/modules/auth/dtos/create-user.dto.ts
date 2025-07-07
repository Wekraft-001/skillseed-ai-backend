import { IsString, IsEmail, MinLength, IsNumber } from 'class-validator';
import { UserRole } from 'src/common/interfaces';

export class CreateAdminOrParentDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsNumber()
  phoneNumber: number;

  @IsString()
  role?: UserRole;

  @IsString()
  @MinLength(6)
  password: string;
}

export class CreateStudentDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsNumber()
  age: number;

  @IsString()
  grade: string;

  @IsString()
  image: string;

  @IsString()
  role?: UserRole;

  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class CreateMentorDto {
  firstName: string;
  lastName: string;
  specialty: string;
  email: string;
  phoneNumber: string;
  image?: string;
}

export class CreateChildDto {
  firstName: string;
  lastName: string;
  age: number;
  grade: string;
  image?: string;
  password: string;
}
