import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
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
import { child } from 'winston';
import { json } from 'stream/consumers';

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

      // const pendingSubscription = await this.subscriptionModel.findOne({
      //   user: userId,
      //   status: SubscriptionStatus.PENDING,
      //   paymentStatus: PaymentStatus.PENDING,
      // });

      // const childTempId = `student-${uuidv4()}`;
      const transactionRef = `subscription-${uuidv4()}`;
      // this.logger.log(
      //   `Generated transactionRef: ${transactionRef} ********* Generated childTempId: ${childTempId}`,
      // );

      const customerData = {
        amount: subscriptionData.amount,
        currency: subscriptionData.currency || 'RWF',
        redirect_url: subscriptionData.redirect_url,
        tx_ref: transactionRef,
        name: `${user.firstName} ${user.lastName}`,
        phonenumber: `+250${user.phoneNumber}`,
        email: user.email,

      };

      this.logger.log(`Creating customer for user ${userId} with customer data: ${JSON.stringify(customerData, null, 2)}  `);

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
        child: null,
        childTempId: subscriptionData.childTempId,
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
        // childTempId,
      };
    } catch (error) {
      this.logger.error('Error creating subscription', error);
      throw new BadRequestException(
        `Failed to create subscription: ${error.message}`,
      );
    }
  }

  async createSubscriptionWithBankTransfer(
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
        tx_ref: transactionRef,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`,
        phonenumber: `+${user.phoneNumber.toString()}`,
        frequency: 'once',
        is_permanent: false, 
      };

      this.logger.log(`Creating virtual account for user ${userId}`);
      const virtualAccountResponse =
        await this.paymentService.createFlutterwaveVirtualAccount(customerData);

      // if (!virtualAccountResponse.data || !virtualAccountResponse.data.account_number) {
      //   this.logger.error('Failed to generate virtual account', JSON.stringify(virtualAccountResponse));
      //   throw new BadRequestException('Failed to generate virtual account');
      // }

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
        child: null
      });

      await subscription.save();
      this.logger.log(
        `Subscription created for user ${userId}: ${transactionRef}`,
      );

      return {
        subscription,
        virtualAccountDetails: virtualAccountResponse.data,
        reference: transactionRef,
      };
    } catch (error) {
      this.logger.error(
        'Error creating subscription with bank transfer',
        error,
      );
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

  // async verifyPayment(transactionRef: string, transactionId?: string) {
  //   try {
  //     this.logger.log(
  //       `🔍 Verifying payment for txRef: ${transactionRef}, transactionId: ${transactionId}`,
  //     );

  //     const subscription = await this.subscriptionModel.findOne({
  //       transactionRef,
  //     });
  //     if (!subscription) {
  //       this.logger.error(
  //         `❌ Subscription not found for txRef: ${transactionRef}`,
  //       );

  //       const allSubscriptions = await this.subscriptionModel
  //         .find({
  //           transactionRef: { $regex: transactionRef.split('-')[0] },
  //         })
  //         .select('transactionRef status user createdAt');

  //       this.logger.log(
  //         `📋 Found ${allSubscriptions.length} subscriptions with similar txRef prefix:`,
  //       );
  //       allSubscriptions.forEach((sub) => {
  //         this.logger.log(
  //           `  - ${sub.transactionRef} | Status: ${sub.status} | User: ${sub.user} `,
  //         );
  //       });

  //       throw new BadRequestException('Subscription not found');
  //     }

  //     this.logger.log(
  //       `✅ Found subscription: ${subscription._id} | Status: ${subscription.status} | User: ${subscription.user}`,
  //     );
  //     //checking if subsc. already active
  //     if (subscription.status === SubscriptionStatus.ACTIVE) {
  //       this.logger.log(
  //         `⚠️  Subscription ${subscription._id} already active, skipping verification`,
  //       );
  //       return {
  //         subscription,
  //         message: 'Payment already verified',
  //         alreadyProcessed: true,
  //       };
  //     }

  //     if (!subscription.flutterwaveTransactionId) {
  //       throw new BadRequestException('No payment transaction found');
  //     }

  //     this.logger.log(`🔄 Verifying payment with Flutterwave...`);
  //     const verificationResponse = await this.paymentService.verifyPayment(
  //       subscription.flutterwaveTransactionId,
  //     );

  //     this.logger.log(`📊 Flutterwave response status: ${verificationResponse?.status}`);

  //     if (
  //       verificationResponse.status === 'success' &&
  //       verificationResponse.data.status === 'successful'
  //     ) {
  //       subscription.status = SubscriptionStatus.ACTIVE;
  //       subscription.isActive = true;
  //       await subscription.save();

  //       this.logger.log(`Subscription activated: ${transactionRef}`);
  //       return { success: true, subscription };
  //     } else {
  //       this.logger.warn(`Payment verification failed for ${transactionRef}`);
  //       return { success: false, message: 'Payment verification failed' };
  //     }
  //   } catch (error) {
  //     this.logger.error('Error verifying payment', error);
  //     throw error;
  //   }
  // }

  async incrementChildrenCount(currentUser: User): Promise<void> {
    const subscription = await this.getActiveSubscription(currentUser);
    if (subscription) {
      subscription.childrenCount += 1;
      await subscription.save();
    }
  }

  async addChildToSubscription(
    parentId: string,
    childId: string,
    childTempId: string,
    session?: ClientSession,
  ) {

    const subscription = await this.subscriptionModel.findOneAndUpdate(
      {
        user: parentId,
        childTempId,
        status: SubscriptionStatus.ACTIVE,
        isActive: true,
        child: null,
      },
      {
        $set: { child: new Types.ObjectId(childId)},
      },
      {
        new: true,
        session,
      },
    );

    if (!subscription) {
      throw new BadRequestException(
        'No active subscription found for this user',
      );
    }

    this.logger.log(
      `Child ${childId} linked to subscription >>>> ${subscription._id}`,
    );

    // subscription.child = new Types.ObjectId(childId);
    // await subscription.save({ session});

    this.logger.log(
      `Child ${childId} added to subscription ${subscription._id} successfully`,
    );  
    return subscription;

  }

  async canAddChild(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionModel.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
      isActive: true,
      child: null, 
    });

    if (!subscription) {
      return false;
    }

    if (subscription.endDate < new Date()) {
      return false;
    }

    return subscription.childrenCount < subscription.maxChildren;
  }

  async getActiveSubscription(
    currentUser: User,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel.findOne({
      user: currentUser._id,
      status: SubscriptionStatus.ACTIVE,
      isActive: true,
      endDate: { $gt: new Date() },
    }).populate('user');
  }

  async getSubscriptionStatus(currentUser: User ) {
    const subscription = await this.getActiveSubscription(currentUser);
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
