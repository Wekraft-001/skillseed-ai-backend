import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
  BadRequestException,
  Query,
  Res,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards';
import { SubscriptionService } from './subscription.service';
import {
  CardPaymentRequest,
  PaymentStatus,
  SubscriptionStatus,
  UserRole,
} from 'src/common/interfaces';
import { CurrentUser } from 'src/common/decorators';
import { User } from 'src/modules/schemas';
import { CreateSubscriptionDto } from 'src/common/interfaces';
import { VerifyPaymentDto } from 'src/common/interfaces/verify-payment.dto';
import { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Subscription } from 'rxjs';
import { Model } from 'mongoose';
import { SubscriptionDocument } from 'src/modules/schemas/subscription.schema';
import { PaymentService } from 'src/payment/payment.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private paymentService: PaymentService,
  ) {}

  @Post('subscribe')
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parents can create subscriptions');
    }

    const result =
      await this.subscriptionService.createSubscriptionWithCardPayment(
        user._id.toString(),
        createSubscriptionDto,
      );

    return {
      message: 'Subscription created. Please complete payment.',
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  }

  @Get('success')
  async handlePaymentSuccess(@Query() query: any, @Res() res: Response) {
    const { transaction_id, tx_ref, childTempId } = query;
    const isVerified = await this.paymentService.verifyPayment(transaction_id);

    if (!isVerified) {
      return res.redirect('/subscription/failed');
    }

      const subscription = await this.subscriptionModel.findOneAndUpdate(
      { transactionRef: tx_ref},
      {
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
        flutterwaveTransactionId: transaction_id,
        isActive: true,
      },
    );

    return res.status(200).json({
      message:
        'Subscription payment successful. Your subscription is now active.',
      transactionId: transaction_id,
      transaction_ref: tx_ref,
      subscriptionStatus: 'ACTIVE',
      childTempId: subscription.childTempId
    });
  }

  @Post('verify-payment')
  async verifyPayment(
    @Body() verifyPaymentDto: VerifyPaymentDto,
    @Request() req,
  ) {
    const user = req.user;

    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parents can verify payments');
    }

    return this.subscriptionService.verifyPayment(
      verifyPaymentDto.transactionRef,
    );
  }

  @Get('status')
  async getSubscriptionStatus(@Request() req) {
    const user = req.user;

    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException(
        'Only parents can check subscription status',
      );
    }

    return this.subscriptionService.getSubscriptionStatus(user._id);
  }

  @Get('can-add-child')
  async canAddChild(@Request() req) {
    const user = req.user;

    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parents can check this');
    }

    const canAdd = await this.subscriptionService.canAddChild(user._id);
    return { canAddChild: canAdd };
  }
}
