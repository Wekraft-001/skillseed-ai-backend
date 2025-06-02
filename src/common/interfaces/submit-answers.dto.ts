import {
  IsNumber,
  IsArray,
  IsOptional,
  IsInt,
  IsString,
} from 'class-validator';

export class AnswerDto {
  @IsInt()
  questionIndex: number;

  @IsString()
  answers: string;
}

export class SubmitAnswersDto {
  @IsNumber()
  quizId: number;

  @IsArray()
  @IsOptional()
  answers?: AnswerDto[];
}
