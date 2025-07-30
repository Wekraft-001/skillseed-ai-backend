import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription, SubscriptionDocument } from '../modules/schemas/subscription.schema';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaymentStatus, SubscriptionStatus } from 'src/common/interfaces';

@Injectable()
export class SubscriptionMonitorService {

  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    private readonly logger: LoggerService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    const now = new Date();
    this.logger.log(`Checking for expired subscriptions at ${now.toISOString()}`);

    const result = await this.subscriptionModel.updateMany(
      {
        status: SubscriptionStatus.ACTIVE,
        endDate: { $lte: now },
      },
      {
        $set: { status: PaymentStatus.FAILED },
      },
    );

    this.logger.log(`Marked ${result.modifiedCount} subscriptions as EXPIRED`);
  }
}
