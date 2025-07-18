import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchoolController } from '../../super_admin/controllers';
import { PasswordService, SchoolOnboardingService } from '../../super_admin/services';
import { LoggerModule } from '../../../../common/logger/logger.module';
import { School, SchoolSchema, User, UserSchema } from '../../../schemas';
import { EmailModule } from 'src/common/utils/mailing/email.module';

@Module({
  imports: [
    EmailModule,
    LoggerModule,
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      // { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SchoolController],
  providers: [SchoolOnboardingService, PasswordService],
  // exports: []
})
export class SchoolModule {}
