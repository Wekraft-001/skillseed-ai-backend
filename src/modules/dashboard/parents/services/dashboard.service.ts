import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  CreateSubscriptionDto,
  CustomerDataDto,
  DashboardResponse,
  DashboardSummary,
  UserRole,
} from 'src/common/interfaces';
import { School, User } from '../../../schemas/index';
import { CreateStudentDto, TempStudentDataDto } from 'src/modules/auth/dtos';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { Subscription } from 'rxjs';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { SubscriptionDocument } from 'src/modules/schemas/subscription.schema';
import { v4 as uuidv4 } from 'uuid';
import passport from 'passport';

@Injectable()
export class ParentDashboardService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(School.name) private readonly schoolModel: Model<School>,
    private readonly logger: LoggerService,

    private readonly subscriptionService: SubscriptionService,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async getDashboardData(user: User): Promise<{
    dashboardResponse: DashboardResponse;
    // summary?: DashboardSummary;
    // currentUser: User;
  }> {
    try {
      this.logger.log(
        `Fetching dashboard data for user: ${user._id} with role: ${user.role}`,
      );

      const dashboardResponse: DashboardResponse = {
        success: true,
        message: 'Dashboard data retrieved successfully',
        timestamp: new Date().toISOString(),
        userId: Number(user._id),
        currentUser: user,
      };

      return {
        dashboardResponse,
        // currentUser: user,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching dashboard data for user: ${user._id}`,
        error,
      );
      throw error;
    }
  }

  async initiateStudentRegistration(
    createStudentDto: CreateStudentDto,
    currentUser: User,
    image?: Express.Multer.File,
  ) {
    if (currentUser.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parents can use this route.');
    }

    const childTempId = `student-${uuidv4()}`;
    const imageUrl = image ? await uploadToAzureStorage(image) : '';

     const hashedPassword = await bcrypt.hash(createStudentDto.password, 10);

    return {
      // paymentLink: createChildPayment.authorizationUrl,
      // reference: createChildPayment.reference,
      // childTempId,
      // message:
      tempData: {
        firstName: createStudentDto.firstName,
        lastName: createStudentDto.lastName,
        age: createStudentDto.age,
        grade: createStudentDto.grade,
        imageUrl,
        role: UserRole.STUDENT,
        password: hashedPassword,
        childTempId,
      },
      message:
        'Student draft data collected. Complete payment to finish student registration.',
    };
  }

  async completeStudentRegistration(
    tempStudentData: TempStudentDataDto,
    subscriptionData: CreateSubscriptionDto,
    currentUser: User,
  ) {
    const session = await this.userModel.db.startSession();
    session.startTransaction();

    try {
      const canAddChild = await this.subscriptionService.canAddChild(
        currentUser._id.toString(),
      );

      if (!canAddChild) {
        throw new BadRequestException(
          'Please complete payment before registering your child.',
        );
      }

     

      const createChildPayment =
        await this.subscriptionService.createSubscriptionWithCardPayment(
          currentUser._id.toString(),
          {
            amount: subscriptionData.amount,
            currency: subscriptionData.currency || 'RWF',
            redirect_url: subscriptionData.redirect_url,
            childTempId: tempStudentData.childTempId,
          },
        );

      if (!createChildPayment.authorizationUrl) {
        throw new NotFoundException(
          'Payment link not found. Please try again.',
        );
      }

      const newUser = new this.userModel({
        firstName: tempStudentData.firstName,
        lastName: tempStudentData.lastName,
        age: tempStudentData.age,
        grade: tempStudentData.grade,
        imageUrl: tempStudentData.imageUrl,
        role: UserRole.STUDENT,
        password: tempStudentData.password,
        createdBy: {
          name: currentUser.firstName + ' ' + currentUser.lastName,
          email: currentUser.email,
          role: currentUser.role,
        },
        // school: currentUser.school,
        childTempId: tempStudentData.childTempId,
      });

      await newUser.save({ session });

      // await this.schoolModel.findByIdAndUpdate(
      //   currentUser.school,
      //   { $push: { students: newUser._id } },
      //   { session },
      // );

      const addedToSubscription =
        await this.subscriptionService.addChildToSubscription(
          currentUser._id.toString(),
          newUser._id.toString(),
          tempStudentData.childTempId,
          session,
        );

      if (!addedToSubscription) {
        throw new BadRequestException('Failed to add child to subscription');
      }

      await this.subscriptionService.incrementChildrenCount(currentUser);

      await session.commitTransaction();
      session.endSession();

      const populatedStudent = await this.userModel
        .findById(newUser._id)
        .populate('createdBy');

      return {
        student: populatedStudent,
        message: 'Student registered successfully after payment.',
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // async registerStudentByParent(
  //   createStudentDto: CreateStudentDto,
  //   subscriptionData: CreateSubscriptionDto,
  //   currentUser: User,
  //   image?: Express.Multer.File,
  // ) {
  //   if (currentUser.role !== UserRole.PARENT) {
  //     throw new BadRequestException('Only parents can use this route.');
  //   }

  //   const canAddChild = await this.subscriptionService.canAddChild(
  //     currentUser._id.toString(),
  //   );

  //   if (!canAddChild) {
  //     throw new BadRequestException(
  //       'Please complete payment before registering your child.',
  //     );
  //   }

  //   if (!createStudentDto.childTempId) {
  //     throw new BadRequestException(
  //       'Missing childTempId. Cannot link to subscription.',
  //     );
  //   }

  //   const childTempId = `student-${uuidv4()}`;

  //   const createChildPayment =
  //     await this.subscriptionService.createSubscriptionWithCardPayment(
  //       currentUser._id.toString(),
  //       {
  //         amount: subscriptionData.amount,
  //         currency: subscriptionData.currency || 'RWF',
  //         redirect_url: subscriptionData.redirect_url,
  //         childTempId,
  //       },
  //     );

  //   if (!createChildPayment.authorizationUrl) {
  //     throw new NotFoundException('Payment link not found. Please try again.');
  //   }

  //   const session = await this.userModel.db.startSession();
  //   session.startTransaction();

  //   try {
  //     const hashedPassword = await bcrypt.hash(createStudentDto.password, 10);

  //     let imageUrl = '';
  //     if (image) {
  //       imageUrl = await uploadToAzureStorage(image);
  //     }

  //     const newUser = new this.userModel({
  //       firstName: createStudentDto.firstName,
  //       lastName: createStudentDto.lastName,
  //       age: createStudentDto.age,
  //       grade: createStudentDto.grade,
  //       imageUrl,
  //       role: UserRole.STUDENT,
  //       password: hashedPassword,
  //       createdBy: {
  //         name: currentUser.firstName + ' ' + currentUser.lastName,
  //         email: currentUser.email,
  //         role: currentUser.role,
  //       },
  //       school: currentUser.school,
  //       childTempId,
  //       paymentLink: createChildPayment.authorizationUrl,
  //     });

  //     await newUser.save({ session });

  //     await this.schoolModel.findByIdAndUpdate(
  //       currentUser.school,
  //       { $push: { students: newUser._id } },
  //       { session },
  //     );

  //     const addingChildToSubscription =
  //       await this.subscriptionService.addChildToSubscription(
  //         currentUser._id.toString(),
  //         newUser._id.toString(),
  //         createStudentDto.childTempId,
  //         session,
  //       );

  //     if (!addingChildToSubscription) {
  //       throw new BadRequestException('Failed to add child to subscription');
  //     }

  //     await this.subscriptionService.incrementChildrenCount(currentUser);

  //     await session.commitTransaction();
  //     session.endSession();

  //     const populatedStudent = await this.userModel
  //       .findById(newUser._id)
  //       .populate('createdBy');
  //     return {
  //       student: populatedStudent,
  //       paymentLink: createChildPayment?.authorizationUrl || '',
  //       message: 'Student registered successfully and payment link created.',
  //       reference: createChildPayment?.reference || '',
  //     };
  //   } catch (error) {
  //     await session.abortTransaction();
  //     session.endSession();
  //     throw error;
  //   }
  // }

  async getStudentsForUser(user: User) {
    const query: any = { role: UserRole.STUDENT };
    if (user.role === UserRole.PARENT) {
      query.createdBy = user._id;
    }

    return this.userModel.find(query).populate('createdBy').lean();
  }
}
