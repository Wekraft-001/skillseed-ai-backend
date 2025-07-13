import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { CardPaymentRequest } from 'src/common/interfaces';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('card/process')
  async processCardPayment(@Body() paymentData: CardPaymentRequest) {
    return this.paymentService.processCardPayment(paymentData);
  }

  @Post('subscription/create')
  async createSubscriptionWithCard(
    @Body()
    data: {
      userId: string;
      planId: string;
      cardPayment: CardPaymentRequest;
    },
  ) {
    return this.subscriptionService.createSubscriptionWithCardPay(
      data.userId,
      data.planId,
      data.cardPayment,
    );
  }

  @Get('verify/:transactionRef')
  async verifyPayment(@Param('transactionRef') transactionRef: string) {
    return this.subscriptionService.verifyPayment(transactionRef);
  }

  @Get('details/:chargeId')
  async getPaymentDetails(@Param('chargeId') chargeId: string) {
    return this.paymentService.getPaymentDetails(chargeId);
  }
}
