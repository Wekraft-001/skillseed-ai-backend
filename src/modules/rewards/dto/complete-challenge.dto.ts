import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteChallengeDto {
  @ApiProperty({
    description: 'Optional notes about the challenge completion',
    example: 'I completed this challenge by building a React app with user authentication.',
    required: false,
  })
  @IsOptional()
  @IsString()
  completionNotes?: string;
}