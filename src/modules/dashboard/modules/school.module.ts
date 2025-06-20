import { Module } from '@nestjs/common';
import { SchoolController } from '../controllers';
import { EmailService, PasswordService, SchoolOnboardingService } from '../services';
import { LoggerModule } from 'src/common/logger/logger.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from 'src/modules/entities/school.entity';
import { User } from 'src/modules/entities';

@Module({
  imports: [
    LoggerModule,
    TypeOrmModule.forFeature([
      School,
      User
    ]),
  ],
  controllers: [SchoolController],
  providers: [SchoolOnboardingService, PasswordService, EmailService],
  // exports: []
})
export class SchoolModule {}
