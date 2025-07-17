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
import { CardPaymentRequest, UserRole } from 'src/common/interfaces';
import { CurrentUser } from 'src/common/decorators';
import { User } from 'src/modules/schemas';
import { CreateSubscriptionDto } from 'src/common/interfaces';
import { VerifyPaymentDto } from 'src/common/interfaces/verify-payment.dto';
import { Response } from 'express';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

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
  async handlePaymentSuccess(
    @Query('transaction_id') transactionId: string,
    @Query('tx_ref') txRef: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    try {
      if (status !== 'successful') {
        throw new HttpException('Payment not successful', 400);
      }
      const subscription = await this.subscriptionService.findAndUpdateTransactionId(txRef, transactionId);
      
      const result = await this.subscriptionService.verifyPayment(txRef);

      if (!result.success) {
        return res.status(400).json({ message: 'Payment verification failed' });
      }

      // return res.redirect(`/subscription/confirmation?ref=${txRef}`);
      return result;
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Verification failed', error: error.message });
    }
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
