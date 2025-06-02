import { forwardRef, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareerQuiz } from '../entities/career-quiz.entity';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    TypeOrmModule.forFeature([CareerQuiz]),
    forwardRef(() => UserModule),
  ],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
