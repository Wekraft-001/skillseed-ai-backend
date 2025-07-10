import {
  IsNumber,
  IsArray,
  IsOptional,
  IsInt,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class AnswerDto {
  @IsInt()
  questionIndex: number;

  @IsString()
  answers: string;
}

export class SubmitAnswersDto {
  @IsString()
  @IsNotEmpty()
  quizId: string;

  @IsArray()
  @IsOptional()
  answers?: AnswerDto[];
}
