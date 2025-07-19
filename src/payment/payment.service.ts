import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  CardDetails,
  CardPaymentRequest,
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

@Injectable()
export class PaymentService {
  private readonly flutterwaveUrl: string;
  private readonly secretKey: string;
  private readonly encryptionKey: string;

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,

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
          phonenumber: `+${customerData.phone.country_code}${customerData.phone.number}`,
        },
        redirect_url:
          customerData.redirect_url ||
          'https://skillseedparent/subscription/success',
      };

      this.logger.log(`Creating payment at: ${url}`);
      this.logger.log(`Payload >>>>>>>>>>>>>>>>>>: ${JSON.stringify(paymentData, null, 2)}`);
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


  async createFlutterwaveVirtualAccount(customerData: any): Promise<FlutterwavePaymentInitiationResponse> {
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
      this.logger.log(`Payload >>>>>>>>>>>>>>>>>>: ${JSON.stringify(paymentData, null, 2)}`);
      this.logger.log(`Headers: Authorization: Bearer ${this.secretKey?.substring(0, 20)}...`);

      const response: AxiosResponse = await axios.post(url, paymentData, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': crypto.randomUUID(),
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      });

      if (response.data.status !== 'success') {
        this.logger.error('Failed to create virtual account', JSON.stringify(response.data));
        throw new BadRequestException('Failed to create virtual account');
      }

      this.logger.log(`Virtual account created: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error('Flutterwave API Error:', JSON.stringify({
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      }));
      throw new BadRequestException('Failed to create virtual account');
    }
  }


  async purchaseChild(subscriptionId: string, user: User) {
    const currentSubcription = await this.subscriptionModel.findById(
      subscriptionId,
      // child: user._id.toString(),
    );



  }



  async verifyPayment(transactionId: string): Promise<any> {
    try {
      const url = `${this.flutterwaveUrl}/transactions/${transactionId}/verify`;

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

      this.logger.log(`Payment verified successfully: ${transactionId}`);
      return response.data;
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
