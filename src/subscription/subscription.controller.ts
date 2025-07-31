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
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards';
import { SubscriptionService } from './subscription.service';
import {
  CardPaymentRequest,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
  UserRole,
} from 'src/common/interfaces';
import { CurrentUser } from 'src/common/decorators';
import { User } from 'src/modules/schemas';
import { CreateSubscriptionDto } from 'src/common/interfaces';
import { VerifyPaymentDto } from 'src/common/interfaces/verify-payment.dto';
import { Response } from 'express';
import { Subscription } from 'src/modules/schemas/subscription.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionDocument } from 'src/modules/schemas/subscription.schema';
import { PaymentService } from 'src/payment/payment.service';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateStudentDto } from 'src/modules/auth/dtos';
import { create } from 'domain';
import { ParentDashboardService } from 'src/modules/dashboard/parents/services/dashboard.service';
import { use } from 'passport';
import { ConfigService } from '@nestjs/config';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private paymentService: PaymentService,
    private parentDashboardService: ParentDashboardService,
    private configService: ConfigService,
  ) {}

  @Get('success')
  async handlePaymentSuccess(
    @Query() query: any,
    @Res() res: Response,
    @CurrentUser() user: User,
  ) {
    const { transaction_id, tx_ref } = query;

    const isVerified = await this.paymentService.verifyPayment(transaction_id);

    if (!isVerified) {
      return res.redirect('/subscription/failed');
    }

    console.error(
      `Webhook callback tx_ref: ${tx_ref}, transaction_id: ${transaction_id}`,
    );

    const usedPaymentMethod =
      PaymentMethod.CREDIT_CARD || PaymentMethod.MOBILE_MONEY;

    const subscription = await this.subscriptionModel.findOneAndUpdate(
      {
        user: user._id,
        transactionRef: tx_ref,
        paymentStatus: PaymentStatus.PENDING,
      },
      {
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
        flutterwaveTransactionId: transaction_id,
        payment_options: usedPaymentMethod,
        isActive: true,
      },
      { new: true },
    );

    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', subscription)

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const tempStudentData =
      await this.parentDashboardService.getTempStudentData(
        subscription.childTempId,
      );

    console.log(
      `>>>>>>>>>>>>>>>>>>>>>>>>>${tempStudentData} the child temp ID ${subscription}`,
    );

    if (!tempStudentData) {
      throw new NotFoundException('Temporary student data not found');
    }

    await this.parentDashboardService.registerFinalStudent(
      tempStudentData,
      user,
    );

    return res.status(200).json({
      message:
        'Subscription payment successful. Your subscription is now active and your student is registered good job',
      transactionId: transaction_id,
      transaction_ref: tx_ref,
      subscriptionStatus: 'ACTIVE',
      childTempId: subscription.childTempId,
    });
  }

  @Get('all-active-subsc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  async getAllActiveSubscriptions(@CurrentUser() user: User) {
    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException(
        'Only parents or school admins can view subscriptions',
      );
    }

    return this.subscriptionService.getActiveSubscription(user);
  }


}
