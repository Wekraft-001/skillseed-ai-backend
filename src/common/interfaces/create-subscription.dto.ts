import { Type } from "class-transformer";
import { IsString, IsNotEmpty, IsNumber, ValidateNested, IsOptional } from "class-validator";
import { CardDetails, CustomerDataDto } from "./card.interface";

export class CreateSubscriptionDto {

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @ValidateNested()
  @Type(() => CustomerDataDto)
  customer: CustomerDataDto;

  @ValidateNested()
  @Type(() => CardDetails)
  card: CardDetails;

  @IsNotEmpty()
  @IsString()
  redirect_url: string;

}