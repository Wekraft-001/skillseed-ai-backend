import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  forwardRef,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  CardDetails,
  CardPaymentRequest,
  CreateSchoolDto,
  CreateSubscriptionDto,
  CustomerDataDto,
  FlutterwaveCharge,
  FlutterwaveCustomer,
  FlutterwavePaymentInitiationResponse,
  FlutterwavePaymentMethod,
  PaymentRequest,
  PaymentResponse,
} from 'src/common/interfaces';
import * as crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { InjectModel } from '@nestjs/mongoose';
import { Subscription } from 'rxjs';
import { SubscriptionDocument } from 'src/modules/schemas/subscription.schema';
import { Model } from 'mongoose';
import { User } from 'src/modules/schemas';
import { ParentDashboardService } from 'src/modules/dashboard/parents/services/dashboard.service';
import { CreateStudentDto, TempStudentDataDto } from 'src/modules/auth/dtos';
import { Create } from 'sharp';

@Injectable()
export class PaymentService {
  private readonly flutterwaveUrl: string;
  private readonly secretKey: string;
  private readonly encryptionKey: string;
  private tempStudentsStore: Record<string, TempStudentDataDto> = {};

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => ParentDashboardService))
    private readonly parentDashboardService: ParentDashboardService,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {
    this.flutterwaveUrl = process.env.FLW_BASE_URL;
    this.secretKey = this.configService.get<string>('FLW_SECRET_KEY');
    this.encryptionKey = process.env.FLW_ENCRYPTIONKEY;
  }

  async createFlutterwaveCustomer(
    customerData: any,
  ): Promise<FlutterwavePaymentInitiationResponse> {
    try {
      const url = `${this.flutterwaveUrl}/payments`;
      const paymentData = {
        tx_ref: customerData.tx_ref,
        amount: customerData.amount || 50,
        currency: customerData.currency || 'USD',
        payment_options: 'card',
        customer: {
          email: customerData.email,
          name: `${customerData.name.first} ${customerData.name.last}`,
          phonenumber: customerData.phonenumber,
        },
        redirect_url:
          customerData.redirect_url || 'https://parents.wekraft.co/addChild',
      };

      this.logger.log(`Creating payment at: ${url}`);
      this.logger.log(
        `Payload >>>>>>>>>>>>>>>>>>: ${JSON.stringify(paymentData, null, 2)}`,
      );
      this.logger.log(
        `Headers: Authorization: Bearer ${this.secretKey?.substring(0, 20)}...`,
      );

      const response: AxiosResponse = await axios.post(url, paymentData, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': crypto.randomUUID(),
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      });

      if (response.data.status !== 'success') {
        this.logger.error('Failed error response');
        throw new BadRequestException('Failed to initiate payment');
      }

      this.logger.log(
        `Payment initiated$$$$$$$$$$ : ${JSON.stringify(response.data.data)}`,
      );

      const customer = response.data;
      this.logger.log(`Customer created: ${JSON.stringify(customer)}`);

      return customer;
    } catch (error) {
      this.logger.error(
        'Flutterwave API Error:',
        JSON.stringify({
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers,
        }),
      );
      throw new BadRequestException('Failed to initiate payment');
    }
  }

  async createFlutterwaveVirtualAccount(
    customerData: any,
  ): Promise<FlutterwavePaymentInitiationResponse> {
    try {
      const url = `${this.flutterwaveUrl}/virtual-account-numbers`;
      const paymentData = {
        tx_ref: customerData.tx_ref,
        amount: customerData.amount,
        currency: customerData.currency,
        email: customerData.email,
        name: customerData.name,
        phonenumber: customerData.phonenumber,
        frequency: customerData.frequency || 'once',
        is_permanent: customerData.is_permanent || false,
        bvn: '',
        narration: `Payment for subscription ${customerData.tx_ref}`,
      };

      this.logger.log(`Creating virtual account at: ${url}`);
      this.logger.log(
        `Payload >>>>>>>>>>>>>>>>>>: ${JSON.stringify(paymentData, null, 2)}`,
      );
      this.logger.log(
        `Headers: Authorization: Bearer ${this.secretKey?.substring(0, 20)}...`,
      );

      const response: AxiosResponse = await axios.post(url, paymentData, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': crypto.randomUUID(),
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      });

      if (response.data.status !== 'success') {
        this.logger.error(
          'Failed to create virtual account',
          JSON.stringify(response.data),
        );
        throw new BadRequestException('Failed to create virtual account');
      }

      this.logger.log(
        `Virtual account created: ${JSON.stringify(response.data)}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Flutterwave API Error:',
        JSON.stringify({
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers,
        }),
      );
      throw new BadRequestException('Failed to create virtual account');
    }
  }

  async purchaseChild(subscriptionId: string, user: User) {
    const currentSubcription = await this.subscriptionModel.findById(
      subscriptionId,
      // child: user._id.toString(),
    );
  }

  async verifyPayment(
    childTempId: string,
    subscriptionData: any,
    currentUser: User,
  ): Promise<any> {
    try {
      const url = `${this.flutterwaveUrl}/transactions/${subscriptionData.flutterwaveTransactionId}/verify`;

      this.logger.log(`Verifying payment at: ${url}`);

      const response: AxiosResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.status !== 'success') {
        this.logger.error('Payment verification failed', response.data);
        throw new BadRequestException('Payment verification failed');
      }

      this.logger.log(
        `Payment verified successfully: ${subscriptionData.flutterwaveTransactionId}`,
      );

      const tempStudentData = this.tempStudentsStore[childTempId];
      if (!tempStudentData) {
        throw new NotFoundException('Temporary student data not found');
      }

      const registrationCompleted =
        await this.parentDashboardService.completeStudentRegistration(
          subscriptionData.childTempId,
          subscriptionData,
          currentUser,
        );
      if (!registrationCompleted) {
        this.logger.error(
          'Failed to complete student registration after payment verification',
        );
      }

      return { message: 'Payment verified and student registered' };
    } catch (error) {
      this.logger.error(
        'Error verifying payment',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Payment verification failed');
    }
  }

  async getTransactionDetails(transactionId: string): Promise<any> {
    try {
      const url = `${this.flutterwaveUrl}/transactions/${transactionId}`;

      this.logger.log(`Getting transaction details at: ${url}`);

      const response: AxiosResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.status !== 'success') {
        this.logger.error('Failed to get transaction details', response.data);
        throw new BadRequestException('Failed to get transaction details');
      }

      this.logger.log(
        `Transaction details retrieved successfully: ${transactionId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Error getting transaction details',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to get transaction details');
    }
  }
}
