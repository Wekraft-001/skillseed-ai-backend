import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PasswordService } from '../../super_admin/services';
import { MentorOnboardingService } from '../services/mentor-onboarding.service';
import { LoggerModule } from '../../../../common/logger/logger.module';
import { Mentor, MentorSchema } from '../../../schemas';
import { EmailModule } from 'src/common/utils/mailing/email.module';
import { MentorController } from '../../super_admin/controllers/mentor.controller';

@Module({
  imports: [
    EmailModule,
    LoggerModule,
    MongooseModule.forFeature([
      { name: Mentor.name, schema: MentorSchema },
      // { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MentorController],
  providers: [MentorOnboardingService, PasswordService],
  // exports: []
})
export class MentorModule {}
