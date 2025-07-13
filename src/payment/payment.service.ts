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
  FlutterwavePaymentMethod,
  PaymentRequest,
  PaymentResponse,
} from 'src/common/interfaces';
import * as crypto from 'crypto';

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
    this.encryptionKey = process.env.FLUTTERWAVE_ENCRYPTIONKEY;
  }

  private encryptCardData(data: string): {
    encrypted_data: string;
    nonce: string;
  } {
    const nonce = crypto.randomBytes(12).toString('hex');
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted_data: encrypted,
      nonce: nonce,
    };
  }

  async createCustomer(
    customerData: CustomerDataDto,
  ): Promise<FlutterwaveCustomer> {
    try {
      const url = `${this.flutterwaveUrl}/customers`;

      const response: AxiosResponse = await axios.post(url, customerData, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': crypto.randomUUID(),
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      });

      if (response.data.status !== 'success') {
        throw new BadRequestException('Failed to create customer');
      }

      this.logger.log(`Customer created: ${response.data.data.id}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Error creating customer', error);
      throw new BadRequestException('Failed to create customer');
    }
  }

  async createCardPaymentMethod(
    card: CardDetails,
    customerId: string,
  ): Promise<FlutterwavePaymentMethod> {
    try {
      const url = `${this.flutterwaveUrl}/payment-methods`;

      const encryptedCardNumber = this.encryptCardData(card.card_number);
      const encryptedExpiryMonth = this.encryptCardData(card.expiry_month);
      const encryptedExpiryYear = this.encryptCardData(card.expiry_year);
      const encryptedCvv = this.encryptCardData(card.cvv);

      const payload = {
        type: 'card',
        customer_id: customerId,
        card: {
          encrypted_card_number: encryptedCardNumber.encrypted_data,
          encrypted_expiry_month: encryptedExpiryMonth.encrypted_data,
          encrypted_expiry_year: encryptedExpiryYear.encrypted_data,
          encrypted_cvv: encryptedCvv.encrypted_data,
          nonce: encryptedCardNumber.nonce,
        },
      };

      const response: AxiosResponse = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': crypto.randomUUID(),
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      });

      if (response.data.status !== 'success') {
        throw new BadRequestException('Failed to create payment method');
      }

      this.logger.log(`Payment method created: ${response.data.data.id}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Error creating payment method', error);
      throw new BadRequestException('Failed to create payment method');
    }
  }

  async createCharge(
    amount: number,
    currency: string,
    customerId: string,
    paymentMethodId: string,
    reference: string,
    redirectUrl: string,
    meta?: any,
  ): Promise<FlutterwaveCharge> {
    try {
      const url = `${this.flutterwaveUrl}/charges`;

      const payload = {
        reference,
        currency,
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        redirect_url: redirectUrl,
        amount,
        meta: meta || {},
      };

      const response: AxiosResponse = await axios.post(url, payload, {
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

  async processCardPayment(paymentData: CardPaymentRequest): Promise<{
    charge: FlutterwaveCharge;
    customer: FlutterwaveCustomer;
    paymentMethod: FlutterwavePaymentMethod;
  }> {
    try {
      const customer = await this.createCustomer(paymentData.customer);

      const paymentMethod = await this.createCardPaymentMethod(
        paymentData.card,
        customer.id,
      );

      const charge = await this.createCharge(
        paymentData.amount,
        paymentData.currency,
        customer.id,
        paymentMethod.id,
        paymentData.reference,
        paymentData.redirect_url,
        paymentData.meta,
      );

      return {
        charge,
        customer,
        paymentMethod,
      };
    } catch (error) {
      this.logger.error('Error processing card payment', error);
      throw error;
    }
  }

  async verifyPayment(transactionId: string): Promise<any> {
    try {
      const url = `${this.flutterwaveUrl}/transactions/${transactionId}/verify`;

      const response: AxiosResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.status !== 'success') {
        throw new BadRequestException('Payment verification failed');
      }

      return response.data;
    } catch (error) {
      this.logger.error('Error verifying payment', error);
      throw new BadRequestException('Payment verification failed');
    }
  }

  async getPaymentDetails(chargeId: string): Promise<any> {
    try {
      const url = `${this.flutterwaveUrl}/charges/${chargeId}`;

      const response: AxiosResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.status !== 'success') {
        throw new BadRequestException('Failed to get payment details');
      }

      return response.data;
    } catch (error) {
      this.logger.error('Error getting payment details', error);
      throw new BadRequestException('Failed to get payment details');
    }
  }
}
