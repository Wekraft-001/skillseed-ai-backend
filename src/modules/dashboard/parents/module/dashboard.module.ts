import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParentDashboardService } from '../services/dashboard.service';
import { ParentDashboardController } from '../controllers/dashboard.controller';
import { School, SchoolSchema, User, UserSchema } from '../../../schemas/index';
import { LoggerModule } from 'src/common/logger/logger.module';
import { Subscription } from 'rxjs';
import { SubscriptionSchema } from 'src/modules/schemas/subscription.schema';
import { SubscriptionModule } from '../../../../subscription/subscription.module';
import { PaymentModule } from 'src/payment/payment.module';
import { TempStudent, TempStudentSchema } from 'src/modules/schemas/temp-student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: TempStudent.name, schema: TempStudentSchema},
    ]),
    LoggerModule,
    forwardRef(() => SubscriptionModule),
    forwardRef(() => PaymentModule),
  ],
  controllers: [ParentDashboardController],
  providers: [ParentDashboardService],
  exports: [ParentDashboardService],
})
export class ParentDashboardModule {}
