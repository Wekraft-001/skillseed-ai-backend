import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  Req,
  Res,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { CardPaymentRequest } from 'src/common/interfaces';
import { Request, Response } from 'express';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
  ) {}
  
  @Post('/flutterwave/webhook')
  @HttpCode(200)
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const event = req.body;

    const flutterwaveSecretHash = process.env.FLUTTERWAVE_HASH;
    const signature = req.headers['verif-hash'];
    if (!signature || signature !== flutterwaveSecretHash) {
      console.warn('⚠️ Invalid Flutterwave signature');
      return res.status(401).send('Invalid signature');
    }

    await this.paymentService.processWebhook(event);

    return res.sendStatus(200);
  }
}
