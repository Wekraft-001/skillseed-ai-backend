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
  SubscriptionStatus,
  UserRole,
} from 'src/common/interfaces';
import { School, User } from '../../../schemas/index';
import { CreateStudentDto, TempStudentDataDto } from 'src/modules/auth/dtos';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { Subscription } from 'rxjs';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { SubscriptionDocument } from 'src/modules/schemas/subscription.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ParentDashboardService {
  private tempStudentsStorage: Record<string, any> = {};

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

    const tempStudentData: TempStudentDataDto = {
      firstName: createStudentDto.firstName,
      lastName: createStudentDto.lastName,
      age: createStudentDto.age,
      grade: createStudentDto.grade,
      imageUrl,
      role: UserRole.STUDENT,
      password: hashedPassword,
      childTempId,
    };

    this.tempStudentsStorage[childTempId] = tempStudentData;

    return {
      tempData: tempStudentData,
      message:
        'Student draft data collected. Complete payment to finish student registration.',
    };
  }

  async completeStudentRegistration(
    childTempId: string,
    subscriptionData: CreateSubscriptionDto,
    currentUser: User,
  ) {
    const tempStudentData = this.tempStudentsStorage[childTempId];
    if (!tempStudentData) {
      throw new NotFoundException('Temporary student data not found.');
    }

    // delete this.tempStudentsStorage[childTempId];

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

      await this.subscriptionService.incrementChildrenCount(currentUser);

      await session.commitTransaction();
      session.endSession();

      return {
        message: 'Payment link generated successfully',
        paymentLink: createChildPayment.authorizationUrl,
        childTempId: tempStudentData.childTempId,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  getTempStudentData(childTempId: string): TempStudentDataDto | undefined {
    return this.tempStudentsStorage[childTempId];
  }

  deleteTempStudentData(childTempId: string): void {
    delete this.tempStudentsStorage[childTempId];
  }

  async registerFinalStudent(
    tempStudentData: TempStudentDataDto,
    user: User,
    // subscription: SubscriptionDocument,
  ) {
    const subscription = await this.subscriptionModel.findOne(
      {
        user: user._id.toString(),
        childTempId: tempStudentData.childTempId,
        status: SubscriptionStatus.ACTIVE,
        isActive: true,
        child: null,
      },
      // {
      //   $set: { child: null }, 
      // },
      // {
      //   new: true,
      // },
    );

    if (!subscription) {
      throw new BadRequestException('Subscription not found or already linked');
    }

  

    const student = new this.userModel({
      firstName: tempStudentData.firstName,
      lastName: tempStudentData.lastName,
      grade: tempStudentData.grade,
      age: tempStudentData.age,
      password: tempStudentData.password,
      role: UserRole.STUDENT,
      imageUrl: tempStudentData.imageUrl,
      parent: user._id,
      subscription: subscription._id,
    });

    subscription.child = new Types.ObjectId(student._id.toString());

    if(subscription.child) {
      this.logger.log(
        `Child ${student._id} linked to subscription >>>> ${subscription._id}`,)
    }

    await student.save();
    return student;
  }

  async getStudentsForUser(user: User) {
    const query: any = { role: UserRole.STUDENT };
    if (user.role === UserRole.PARENT) {
      query.createdBy = user._id;
    }

    return this.userModel.find(query).populate('createdBy').lean();
  }
}
