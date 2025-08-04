import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import {
  Subscription,
  SubscriptionSchema,
} from 'src/modules/schemas/subscription.schema';
import { PaymentModule } from 'src/payment/payment.module';
import { LoggerModule } from 'src/common/logger/logger.module';
import { User, UserSchema } from 'src/modules/schemas';
import { HttpModule } from '@nestjs/axios';
import { ParentDashboardModule } from 'src/modules/dashboard/parents/module/dashboard.module';
import { SubscriptionMonitorService } from './subscription-monitor.service';
import { EmailModule } from 'src/common/utils/mailing/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PaymentModule,
    LoggerModule,
    HttpModule,
    ParentDashboardModule,
    EmailModule
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionMonitorService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
