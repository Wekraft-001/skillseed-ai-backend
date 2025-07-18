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

@Injectable()
export class SchoolDashboardService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<School>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly logger: LoggerService,
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

  async registerStudentBySchoolAdmin(
    createStudentDto: CreateStudentDto,
    currentUser: User,
    image?: Express.Multer.File,
  ) {
    if (currentUser.role !== UserRole.SCHOOL_ADMIN) {
      throw new BadRequestException('Only School Admin can register students.');
    }

    const school = await this.schoolModel.findOne({ _id: currentUser.school });
    if (!school) {
      throw new BadRequestException('School not found.');
    }

    const session = await this.userModel.db.startSession();
    let committed = false;

    try {
      session.startTransaction();
      const hashedPassword = await bcrypt.hash(createStudentDto.password, 10);

      let imageUrl = '';
      if (image) {
        imageUrl = await uploadToAzureStorage(image);
      }

      const currentStudentCount = await this.userModel.countDocuments({
        school: school._id,
        role: UserRole.STUDENT,
        deletedAt: null,
      });

      if (
        school.studentsLimit !== null &&
        school.studentsLimit !== undefined &&
        currentStudentCount >= school.studentsLimit
      ) {
        throw new BadRequestException(
          `Cannot add more students. School has reached its limit of ${school.studentsLimit} students.`,
        );
      }

      const newStudent = new this.userModel({
        ...createStudentDto,
        role: UserRole.STUDENT,
        password: hashedPassword,
        imageUrl,
        school: school._id,
        createdBy: currentUser._id,
      });

      console.log('Creating student with createdBy:', currentUser._id);

      await newStudent.save({ session });

      await this.schoolModel.findByIdAndUpdate(
        school._id,
        { $push: { students: newStudent._id } },
        { session },
      );

      await session.commitTransaction();
      committed = true;

      return await this.userModel
        .findById(newStudent._id)
        .populate('createdBy');
    } catch (error) {
      if (!committed) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  // async getStudentsForUser(user: User) {
  //   const query: any = { role: UserRole.STUDENT };

  //   if (user.role === UserRole.SCHOOL_ADMIN && user.school) {
  //     query.school = user.school;
  //   } else if (user.role === UserRole.PARENT) {
  //     query.createdBy = user._id;
  //   }

  //   return this.userModel.find(query).populate('createdBy').lean();
  // }

  async getStudentsForUser(user: User) {
    const query: any = { role: UserRole.STUDENT };
    if (user.role === UserRole.SCHOOL_ADMIN) {
      query.createdBy = user._id;
    }

    return this.userModel.find(query).populate('createdBy').lean();
  }
}
