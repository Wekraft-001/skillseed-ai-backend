import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../common/logger/logger.module';
import { PaymentController } from './payment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscription } from 'rxjs';
import { SubscriptionSchema } from 'src/modules/schemas/subscription.schema';
import { forwardRef } from '@nestjs/common';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { ParentDashboardModule } from 'src/modules/dashboard/parents/module/dashboard.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    forwardRef(() => SubscriptionModule),
    forwardRef(() => ParentDashboardModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
