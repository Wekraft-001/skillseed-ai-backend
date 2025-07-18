import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  DashboardResponse,
  DashboardSummary,
  UserRole,
} from 'src/common/interfaces';
import { School, User } from '../../../schemas/index';
import { CreateStudentDto } from 'src/modules/auth/dtos';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { Subscription } from 'rxjs';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { SubscriptionDocument } from 'src/modules/schemas/subscription.schema';

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

  async registerStudentByParent(
    createStudentDto: CreateStudentDto,
    currentUser: User,
    image?: Express.Multer.File,
  ) {
    if (currentUser.role !== UserRole.PARENT) {
      throw new BadRequestException('Only parents can use this route.');
    }

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

      if (!createStudentDto.childTempId) {
        throw new BadRequestException(
          'Missing childTempId. Cannot link to subscription.',
        );
      }

      const hashedPassword = await bcrypt.hash(createStudentDto.password, 10);

      let imageUrl = '';
      if (image) {
        imageUrl = await uploadToAzureStorage(image);
      }

      const newUser = new this.userModel({
        firstName: createStudentDto.firstName,
        lastName: createStudentDto.lastName,
        age: createStudentDto.age,
        grade: createStudentDto.grade,
        imageUrl,
        role: UserRole.STUDENT,
        password: hashedPassword,
        createdBy: {
          name: currentUser.firstName + ' ' + currentUser.lastName,
          email: currentUser.email,
          role: currentUser.role,
        },
        school: currentUser.school,
      });

      await newUser.save({ session });

      await this.schoolModel.findByIdAndUpdate(
        currentUser.school,
        { $push: { students: newUser._id } },
        { session },
      );

      await this.subscriptionService.addChildToSubscription(
        currentUser._id.toString(),
        newUser._id.toString(),
        createStudentDto.childTempId,
        session,
      );

      await this.subscriptionService.incrementChildrenCount(
        currentUser._id.toString(),
      );

      await session.commitTransaction();
      session.endSession();

      return await this.userModel.findById(newUser._id).populate('createdBy');
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getStudentsForUser(user: User) {
    const query: any = { role: UserRole.STUDENT };
    if (user.role === UserRole.PARENT) {
      query.createdBy = user._id;
    }

    return this.userModel.find(query).populate('createdBy').lean();
  }
}
