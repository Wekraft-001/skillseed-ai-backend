import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards';
import { SubscriptionService } from './subscription.service';
import { UserRole } from 'src/common/interfaces';
import { CurrentUser } from 'src/common/decorators';
import { User } from 'src/modules/schemas';
import { CreateSubscriptionDto } from 'src/common/interfaces';
import { VerifyPaymentDto } from 'src/common/interfaces/verify-payment.dto';

@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Post('create')
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parents can create subscriptions');
    }

    return this.subscriptionService.createSubscription(
      user,
      createSubscriptionDto.phoneNumber,
    );
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
