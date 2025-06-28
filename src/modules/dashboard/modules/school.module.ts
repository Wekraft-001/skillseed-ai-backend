import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchoolController } from '../controllers';
import {
  EmailService,
  PasswordService,
  SchoolOnboardingService,
} from '../services';
import { LoggerModule } from '../../../common/logger/logger.module';
import { School, SchoolSchema, User, UserSchema } from '../../schemas';

@Module({
  imports: [
    LoggerModule,
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SchoolController],
  providers: [SchoolOnboardingService, PasswordService, EmailService],
  // exports: []
})
export class SchoolModule {}
