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

  @Post('subscription/create')
  async createSubscriptionWithCard(
    @Body()
    data: {
      userId: string;
    //   planId: string;
      cardPayment: CardPaymentRequest;
    },
  ) {
    return this.subscriptionService.createSubscriptionWithCardPayment(
      data.userId,
    //   data.planId,
      data.cardPayment,
    );
  }

}
