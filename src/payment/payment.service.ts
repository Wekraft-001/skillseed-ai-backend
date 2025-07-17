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

@Injectable()
export class PaymentService {
  private readonly flutterwaveUrl: string;
  private readonly secretKey: string;
  private readonly encryptionKey: string;

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.flutterwaveUrl = process.env.FLUTTERWAVE_BASE_URL;
    this.secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY');
    this.encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY;
  }

  async encryptCardDetails(cardDetails: {
    card_number: string;
    expiry_month: string;
    expiry_year: string;
    cvv: string;
  }): Promise<
    Promise<{
      encrypted_card_number: string;
      encrypted_expiry_month: string;
      encrypted_expiry_year: string;
      encrypted_cvv: string;
      nonce: string;
    }>
  > {
    try {
      if (!this.encryptionKey) {
        this.logger.error('Encryption key is not set');
      }

      // const key = Buffer.from(this.encryptionKey, 'base64');
      const key = crypto.randomBytes(32);
      const base64Key = key.toString('base64');

      console.log('Base64 key *********************', base64Key);

      if (key.length !== 32) {
        throw new Error(
          `Invalid key length: ${key.length}. AES-256 requires 32 bytes`,
        );
      }

      const nonce = crypto.randomBytes(12).toString('hex');
      const iv = Buffer.from(nonce, 'hex');

      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encryptedCardNumber = cipher.update(
        cardDetails.card_number,
        'utf8',
        'hex',
      );
      encryptedCardNumber += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      const expiryMonthCipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encryptedExpiryMonth = expiryMonthCipher.update(
        cardDetails.expiry_month,
        'utf8',
        'hex',
      );
      encryptedExpiryMonth += expiryMonthCipher.final('hex');

      const expiryYearCipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encryptedExpiryYear = expiryYearCipher.update(
        cardDetails.expiry_year,
        'utf8',
        'hex',
      );
      encryptedExpiryYear += expiryYearCipher.final('hex');

      const cvvCipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encryptedCvv = cvvCipher.update(cardDetails.cvv, 'utf8', 'hex');
      encryptedCvv += cvvCipher.final('hex');

      return {
        encrypted_card_number: encryptedCardNumber,
        encrypted_expiry_month: encryptedExpiryMonth,
        encrypted_expiry_year: encryptedExpiryYear,
        encrypted_cvv: encryptedCvv,
        nonce,
      };
    } catch (error) {
      this.logger.error('Error encrypting card details', error);
      throw new BadRequestException('Failed to encrypt card details');
    }
  }

  async createStandardPayment(paymentData: {
    tx_ref: string;
    amount: number;
    currency: string;
    redirect_url: string;
    customer: {
      email: string;
      name: string;
      phoneNumber: string;
    };
    payment_options?: string;
    meta?: any;
  }): Promise<any> {
    try {
      const url = `${this.flutterwaveUrl}/payments`;

      this.logger.log(`Creating standard payment at: ${url}`);
      this.logger.log(`Payload: ${JSON.stringify(paymentData, null, 2)}`);

      const response: AxiosResponse = await axios.post(url, paymentData, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.status !== 'success') {
        this.logger.error('Failed to create payment', response.data);
        throw new BadRequestException('Failed to create payment');
      }

      this.logger.log(`Payment created successfully: ${response.data.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        'Flutterwave API Error:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to create payment');
    }
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

  async createFlutterwaveCharge(chargeData: {
    reference: string;
    currency: string;
    customer_id: string;
    payment_method_id: string;
    redirect_url: string;
    amount: number;
    meta?: any;
  }): Promise<any> {
    try {
      const url = `${this.flutterwaveUrl}/charges`;

      const response: AxiosResponse = await axios.post(url, chargeData, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': crypto.randomUUID(),
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      });

      if (response.data.status !== 'success') {
        throw new BadRequestException('Failed to create charge');
      }

      this.logger.log(`Charge created: ${response.data.data.id}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Error creating charge', error);
      throw new BadRequestException('Failed to create charge');
    }
  }

  async createFlutterwavePaymentMethod(customerData: any) {
    try {
      this.logger.log(
        'Customer data being sent$$$$$$$$$$$$$$$$$$$$$: ',
        JSON.stringify(customerData, null, 2),
      );
      const response = await axios.post(
        `${this.flutterwaveUrl}/customers`,
        customerData,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
            'X-Trace-Id': uuid(),
            'X-Idempotency-Key': uuid(),
          },
        },
      );
      this.logger.log(`Payment method created: ${response.data.data.id}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Error creating Flutterwave payment method', error);
      throw new Error(
        `Failed to create payment method: ${error.response?.data?.message || error.message}`,
      );
    }
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
