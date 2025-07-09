import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaymentRequest, PaymentResponse } from 'src/common/interfaces';

@Injectable()
export class PaymentService {
  private readonly flutterwaveUrl = process.env.FLUTTERWAVE_BASE_URL;
  private readonly secretKey: string;

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY');
  }

  async initiateMobileMoneyPayment(
    paymentData: PaymentRequest,
  ): Promise<PaymentResponse> {
    try {
      const url = `${this.flutterwaveUrl}/charges?type=mobile_money_rwanda`;

      const payload = {
        amount: paymentData.amount,
        currency: paymentData.currency,
        email: paymentData.email,
        tx_ref: paymentData.tx_ref,
        order_id: paymentData.order_id,
        phone_number: paymentData.phone_number,
        fullname: paymentData.fullname,
        client_ip: this.getClientIp(),
        device_fingerprint: this.generateDeviceFingerprint(),
        meta: paymentData.meta || {},
      };

      const response: AxiosResponse = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        validateStatus: () => true,
      });

      if (!response.data) {
        throw new Error('Empty response from Flutterwave');
      }

      this.logger.log(`Payment initiated: ${paymentData.tx_ref}`);
      return response.data;
    } catch (error) {
      // this.logger.error(
      //   'Payment initiation failed',
      //   error,
      // );
      // throw new BadRequestException('Payment initiation failed');
      // throw new HttpException(
      // error.response?.data?.message || 'Payment initiation failed',
      // error.response?.status || HttpStatus.BAD_REQUEST
      throw error;
    }
  }

  async verifyPayment(transactionId: string): Promise<PaymentResponse> {
    try {
      const url = `${this.flutterwaveUrl}/transactions/${transactionId}/verify`;

      const response: AxiosResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      this.logger.log(`Payment verified: ${transactionId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        'Payment verification failed',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Payment verification failed');
    }
  }

  private getClientIp(): string {
    return '154.123.220.1';
  }

  private generateDeviceFingerprint(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  generateTransactionReference(): string {
    return `PARENT_SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
