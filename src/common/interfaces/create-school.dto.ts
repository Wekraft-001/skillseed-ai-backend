import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { UserRole } from './user-role.enum';

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @IsString()
  @IsNotEmpty()
  schoolType: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  // @IsString()
  // logoUrl: string;

  @IsString()
  role?: UserRole;

  @IsString()
  @IsNotEmpty()
  password: string;
}
