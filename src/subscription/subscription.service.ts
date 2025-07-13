// src/subscription/subscription.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CardPaymentRequest, PaymentStatus, SubscriptionStatus } from 'src/common/interfaces';
import {
  Subscription,
  SubscriptionDocument,
} from 'src/modules/schemas/subscription.schema';
import { User, UserDocument } from 'src/modules/schemas';
import { PaymentService } from '../payment/payment.service';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private paymentService: PaymentService,
    private logger: LoggerService,
  ) {}

  async createSubscriptionWithCardPay(
    userId: string,
    planId: string,
    cardPaymentData: CardPaymentRequest,
  ) {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const transactionRef = `sub_${Date.now()}_${userId}`;
      cardPaymentData.reference = transactionRef;

      const paymentResult =
        await this.paymentService.processCardPayment(cardPaymentData);

      const subscription = new this.subscriptionModel({
        user: userId,
        plan: planId,
        transactionRef,
        status: PaymentStatus.PENDING,
        isActive: false,
        flutterwaveTransactionId: paymentResult.charge.id,
        flutterwaveCustomerId: paymentResult.customer.id,
        flutterwavePaymentMethodId: paymentResult.paymentMethod.id,
        amount: cardPaymentData.amount,
        currency: cardPaymentData.currency,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        childrenCount: 0,
        maxChildren: 5,
      });

      await subscription.save();

      this.logger.log(
        `Subscription created for user ${user._id}: ${transactionRef}`,
      );
      return { subscription, charge: paymentResult.charge, authorizationUrl: paymentResult.charge.authorization_url };
    } catch (error) {
      this.logger.error('Error creating subscription', error);
      throw error;
    }
  }

  async verifyPayment(transactionRef: string) {
    try {
      const subscription = await this.subscriptionModel.findOne({
        transactionRef,
      });
      if (!subscription) {
        throw new BadRequestException('Subscription not found');
      }

      if (!subscription.flutterwaveTransactionId) {
        throw new BadRequestException('No payment transaction found');
      }

      const verificationResponse = await this.paymentService.verifyPayment(
        subscription.flutterwaveTransactionId,
      );

      if (
        verificationResponse.status === 'success' &&
        verificationResponse.data.status === 'successful'
      ) {
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.isActive = true;
        await subscription.save();

        this.logger.log(`Subscription activated: ${transactionRef}`);
        return { success: true, subscription };
      } else {
        this.logger.warn(`Payment verification failed for ${transactionRef}`);
        return { success: false, message: 'Payment verification failed' };
      }
    } catch (error) {
      this.logger.error('Error verifying payment', error);
      throw error;
    }
  }

  async getActiveSubscription(
    userId: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
      isActive: true,
      endDate: { $gt: new Date() },
    });
  }

  async incrementChildrenCount(userId: string): Promise<void> {
    const subscription = await this.getActiveSubscription(userId);
    if (subscription) {
      subscription.childrenCount += 1;
      await subscription.save();
    }
  }

  async canAddChild(userId: string): Promise<boolean> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) return false;

    return subscription.childrenCount < subscription.maxChildren;
  }

  async getSubscriptionStatus(userId: string) {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      return {
        hasActiveSubscription: false,
        message: 'No active subscription',
      };
    }

    return {
      hasActiveSubscription: true,
      subscription: {
        status: subscription.status,
        childrenCount: subscription.childrenCount,
        maxChildren: subscription.maxChildren,
        remainingChildren:
          subscription.maxChildren - subscription.childrenCount,
        endDate: subscription.endDate,
      },
    };
  }
}
