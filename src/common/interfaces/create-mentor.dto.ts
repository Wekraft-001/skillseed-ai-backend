import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';
import { UserRole } from './user-role.enum';

export class CreateMentorDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  specialty: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  password?: string;
}
