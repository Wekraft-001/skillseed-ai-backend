// src/subscription/subscription.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionStatus } from 'src/common/interfaces';
import { Subscription, SubscriptionDocument } from 'src/modules/schemas/subscription.schema';
import { User } from 'src/modules/schemas';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    private paymentService: PaymentService,
  ) {}

  async createSubscription(user: User, phoneNumber: string) {
    try {
      const existingSubscription = await this.getActiveSubscription(user._id);
      if (existingSubscription) {
        throw new BadRequestException('You already have an active subscription');
      }

      const transactionRef = this.paymentService.generateTransactionReference();
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const subscription = new this.subscriptionModel({
        user: user._id,
        amount: 72000,
        currency: 'RWF',
        transactionRef,
        status: SubscriptionStatus.PENDING,
        startDate,
        endDate,
        maxChildren: 30,
        childrenCount: 0,
        isActive: false,
      });

      await subscription.save();

      // Initiate payment
      const paymentData = {
        amount: 72000,
        currency: 'RWF',
        email: user.email,
        phone_number: phoneNumber,
        fullname: `${user.firstName} ${user.lastName}`,
        tx_ref: transactionRef,
        order_id: `SUB_${subscription._id}`,
        meta: {
          subscriptionId: subscription._id,
          userId: user._id,
          purpose: 'Monthly subscription for adding children'
        }
      };

      const paymentResponse = await this.paymentService.initiateMobileMoneyPayment(paymentData);

      // Update subscription with payment data
      subscription.paymentData = paymentResponse;
      if (paymentResponse.data?.id) {
        subscription.flutterwaveTransactionId = paymentResponse.data.id;
      }
      await subscription.save();

      this.logger.log(`Subscription created for user ${user._id}: ${transactionRef}`);
      return { subscription, paymentResponse };
    } catch (error) {
      this.logger.error('Error creating subscription', error);
      throw error;
    }
  }

  async verifyPayment(transactionRef: string) {
    try {
      const subscription = await this.subscriptionModel.findOne({ transactionRef });
      if (!subscription) {
        throw new BadRequestException('Subscription not found');
      }

      if (!subscription.flutterwaveTransactionId) {
        throw new BadRequestException('No payment transaction found');
      }

      const verificationResponse = await this.paymentService.verifyPayment(subscription.flutterwaveTransactionId);
      
      if (verificationResponse.status === 'success' && verificationResponse.data.status === 'successful') {
        // Activate subscription
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

  async getActiveSubscription(userId: string): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
      isActive: true,
      endDate: { $gt: new Date() }
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
      return { hasActiveSubscription: false, message: 'No active subscription' };
    }

    return {
      hasActiveSubscription: true,
      subscription: {
        status: subscription.status,
        childrenCount: subscription.childrenCount,
        maxChildren: subscription.maxChildren,
        remainingChildren: subscription.maxChildren - subscription.childrenCount,
        endDate: subscription.endDate
      }
    };
  }
}