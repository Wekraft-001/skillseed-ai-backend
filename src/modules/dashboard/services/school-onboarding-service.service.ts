import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { School, SchoolDocument } from '../../schemas/school.schema';
import { User, UserDocument } from '../../schemas';
import { LoggerService } from 'src/common/logger/logger.service';
import { PasswordService } from '.';
import { EmailService } from '.';
import { CreateSchoolDto, UserRole } from 'src/common/interfaces';

@Injectable()
export class SchoolOnboardingService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly logger: LoggerService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
  ) {}

  async onboardSchool(
    createSchoolDto: CreateSchoolDto,
    superAdmin: User,
  ): Promise<{ school: School; admin: User }> {
    const session: ClientSession = await this.schoolModel.db.startSession();
    // const queryRunner = this.schoolRepo.manager.connection.createQueryRunner();

    try {
      session.startTransaction();

      const username = this.generateUsername(createSchoolDto.schoolName);
      const tempPassword = this.passwordService.generateRandomPassword();
      const hashedPassword =
        await this.passwordService.hashPassword(tempPassword);

      const adminUser = new this.userModel({
        firstName: 'Admin',
        lastName: createSchoolDto.schoolName,
        email: createSchoolDto.email,
        password: hashedPassword,
        role: UserRole.SCHOOL_ADMIN,
      });

      await adminUser.save({ session });

      const school = new this.schoolModel({
        schoolName: createSchoolDto.schoolName,
        address: createSchoolDto.address,
        logoUrl: createSchoolDto.logoUrl,
        phoneNumber: createSchoolDto.phoneNumber,
        email: createSchoolDto.email,
        admin: adminUser._id,
        superAdmin: superAdmin._id,
      });

      await school.save({ session });

      // updating admin user with school reference
      adminUser.school = school._id as Types.ObjectId;
      await adminUser.save({ session: session });

      await this.emailService.sendSchoolOnboardingEmail(
        createSchoolDto.email,
        username,
        tempPassword,
      );

      const populatedSchool = await this.schoolModel
        .findById(school._id)
        .populate('admin superAdmin')
        .exec();

      return { school: populatedSchool, admin: adminUser };
    } catch (error) {
      session.abortTransaction();
      this.logger.error('Error during school onboarding', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAllSchools(): Promise<School[]> {
    try {
      return await this.schoolModel
        .find()
        .populate('admin superAdmin users')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error('Error fetching schools', error);
      throw error;
    }
  }

  async deleteSchool(schoolId: number) {
    const session = await this.schoolModel.db.startSession();
    session.startTransaction();

    try {
      const school = await this.schoolModel
        .findById(schoolId)
        .populate('admin users')
        .session(session)
        .exec();

      if (!school) {
        throw new NotFoundException(`School with ID ${schoolId} not found`);
      }

      if (school.users?.length) {
        const userIds = school.users.map((user) => user._id);
        await this.userModel.updateMany(
          { _id: { $in: userIds } },
          { deletedAt: new Date() },
          { session },
        );
      }

      if (school.admin) {
        await this.userModel.findByIdAndUpdate(
          school.admin._id,
          { deletedAt: new Date() },
          { session },
        );
      }

      await this.schoolModel.findByIdAndUpdate(
        schoolId,
        { deletedAt: new Date() },
        { session },
      );

      await session.commitTransaction();

      this.logger.log(`School with ID ${schoolId} deleted successfully`);
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error deleting school', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async restoreSchool(schoolId: string) {
    const session = await this.schoolModel.db.startSession();
    session.startTransaction();

    try {
      await this.schoolModel.findByIdAndUpdate(
        schoolId,
        { $unset: { deletedAt: 1 } },
        { session },
      );

      await this.userModel.updateMany(
        { school: schoolId },
        { $unset: { deletedAt: 1 } },
        { session },
      );

      const school = await this.schoolModel.findById(schoolId).session(session);
      if (school?.admin) {
        await this.userModel.findByIdAndUpdate(
          school.admin,
          { $unset: { deletedAt: 1 } },
          { session },
        );
      }

      await session.commitTransaction();
    } catch (error) {
      // await session.rollbackTransaction()
      throw error;
    } finally {
      session.endSession();
    }
  }

  private generateUsername(schoolName: string): string {
    return (
      schoolName
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '') + '_admin'
    );
  }
}
