import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from '../modules/schemas/subscription.schema';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaymentStatus, SubscriptionStatus } from 'src/common/interfaces';
import { EmailService } from 'src/common/utils/mailing/email.service';
import { User } from 'src/modules/schemas';

@Injectable()
export class SubscriptionMonitorService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    private readonly logger: LoggerService,
    private emailService: EmailService,
    @InjectModel(User.name) private readonly userModel: Model<User>
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    const now = new Date();
    this.logger.log(
      `Checking for expired subscriptions at ${now.toISOString()}`,
    );

    const expiredSubscriptions = await this.subscriptionModel
      .find({
        status: 'active',
        endDate: { $lte: now },
      })
      .exec();

    console.log(expiredSubscriptions)
    const userIds = expiredSubscriptions.map((sub) => sub.user);

    const users = await this.userModel.find({_id: { $in: userIds}}).exec();

    for (const user of users) {

      try {
        await this.emailService.sendExpiredSubscriptionEmail(
          user.email,
          user.firstName,
        );
      } catch (error) {
        this.logger.error(
          `Failed to email user ${user.email}: ${error.message}`,
        );
      }
    }

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
