import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateSubscriptionDto,
  PaymentStatus,
  SubscriptionStatus,
} from 'src/common/interfaces';
import {
  Subscription,
  SubscriptionDocument,
} from 'src/modules/schemas/subscription.schema';
import { User, UserDocument } from 'src/modules/schemas';
import { PaymentService } from '../payment/payment.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { HttpService } from '@nestjs/axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private paymentService: PaymentService,
    private logger: LoggerService,
    private readonly httpService: HttpService,
  ) {}

  async createSubscriptionWithCardPayment(
    userId: string,
    subscriptionData: CreateSubscriptionDto,
  ) {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const transactionRef = `subscription-${uuidv4()}`;
      this.logger.log(`Generated transactionRef: ${transactionRef}`);

      const customerData = {
        amount: subscriptionData.amount,
        currency: subscriptionData.currency || 'RWF',
        redirect_url: subscriptionData.redirect_url,
        tx_ref: transactionRef,
        name: {
          first: user.firstName || '',
          middle: '',
          last: user.lastName || '',
        },
        phone: {
          country_code: '250',
          number: user.phoneNumber.toString(),
        },
        email: user.email,
        address: {
          city: 'Kigali',
          country: 'RW',
          line1: '',
          line2: '',
          postal_code: '',
          state: 'Kigali',
        },
      };

      this.logger.log(`Creating customer for user ${userId}`);

      const hostedPayment =
        await this.paymentService.createFlutterwaveCustomer(customerData);
      const hostedLink = hostedPayment.data?.link;

      if (!hostedLink) {
        this.logger.error(
          'Failed to generate hosted payment link',
          JSON.stringify(hostedPayment),
        );
        throw new BadRequestException('Failed to generate payment link');
      }

      const subscription = new this.subscriptionModel({
        user: userId,
        transactionRef,
        status: PaymentStatus.PENDING,
        isActive: false,
        amount: subscriptionData.amount,
        currency: subscriptionData.currency,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        childrenCount: 0,
        maxChildren: 30,
      });

      await subscription.save();
      this.logger.log(
        `Subscription created for user ${userId}: ${transactionRef}`,
      );

      return {
        subscription,
        authorizationUrl: hostedLink,
        reference: transactionRef,
      };
    } catch (error) {
      this.logger.error('Error creating subscription', error);
      throw new BadRequestException(
        `Failed to create subscription: ${error.message}`,
      );
    }
  }

  async verifyFlutterwaveTransaction(transactionId: string) {
    try {
      const { data } = await this.httpService.axiosRef.get(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          },
        },
      );

      if (data.status === 'success' && data.data.status === 'successful') {
        return data.data;
      } else {
        throw new Error('Payment not verified');
      }
    } catch (error) {
      throw new HttpException(error.message || 'Verification failed', 500);
    }
  }

  async handlePaymentWebhook(webhookData: any) {
    let tx_ref: string | undefined;
    try {
      const {
        tx_ref: txRefFromWebhook,
        status,
        id,
        card_token,
      } = webhookData.data;
      tx_ref = txRefFromWebhook;
      this.logger.log(`Processing webhook for transaction ${tx_ref}`);

      const subscription = await this.subscriptionModel.findOne({
        transactionRef: tx_ref,
      });
      if (!subscription) {
        this.logger.error(`Subscription not found for transaction ${tx_ref}`);
        throw new BadRequestException('Subscription not found');
      }

      if (status === 'successful') {
        (subscription.status = SubscriptionStatus.ACTIVE),
          (subscription.isActive = true);
        subscription.flutterwaveCardToken =
          card_token || subscription.flutterwaveCardToken;
        subscription.endDate = new Date(
          subscription.endDate.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
        await subscription.save();
        this.logger.log(`Subscription activated for transaction ${tx_ref}`);
      } else if (status === 'failed') {
        (subscription.status = SubscriptionStatus.CANCELLED),
          await subscription.save();
        this.logger.error(`Payment failed for transaction ${tx_ref}`);
      }

      return { status: 'success', message: 'Webhook processed' };
    } catch (error) {
      this.logger.error(
        `Error processing webhook for transaction ${tx_ref ?? 'unknown'}`,
        error,
      );
      throw new BadRequestException(
        `Webhook processing failed: ${error.message}`,
      );
    }
  }

  async findAndUpdateTransactionId(
    transactionRef: string,
    transactionId: string,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel.findOne({
      transactionRef,
    });
    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }
    if (!subscription.flutterwaveTransactionId) {
      subscription.flutterwaveTransactionId = transactionId;
      await subscription.save();
      this.logger.log(
        `Updated flutterwaveTransactionId for ${transactionRef}: ${transactionId}`,
      );
    }
    return subscription;
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
