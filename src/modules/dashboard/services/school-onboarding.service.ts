import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { School } from '../../schemas/school.schema';
import { User, UserDocument } from '../../schemas';
import { LoggerService } from 'src/common/logger/logger.service';
import { PasswordService } from '.';
import { CreateSchoolDto, UserRole } from 'src/common/interfaces';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { EmailService } from '../../../common/utils/mailing/email.service';

@Injectable()
export class SchoolOnboardingService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<School>,
    private readonly logger: LoggerService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
  ) {}

  async onboardSchool(
    createSchoolDto: CreateSchoolDto,
    superAdmin: User,
    logoFile?: Express.Multer.File,
  ): Promise<School> {
    const session: ClientSession = await this.schoolModel.db.startSession();

    try {
      session.startTransaction();

      // Generate random password and hash it
      const tempPassword = this.passwordService.generateRandomPassword();
      const hashedPassword =
        await this.passwordService.hashPassword(tempPassword);

      // Upload logo to Azure
      let logoUrl = '';
      if (logoFile) {
        logoUrl = await uploadToAzureStorage(logoFile);
      }

      // Create the school document
      const newSchool = new this.schoolModel({
        schoolName: createSchoolDto.schoolName,
        schoolType: createSchoolDto.schoolType,
        schoolContactPerson: createSchoolDto.schoolContactPerson,
        email: createSchoolDto.email,
        phoneNumber: createSchoolDto.phoneNumber,
        address: createSchoolDto.address,
        city: createSchoolDto.city,
        country: createSchoolDto.country,
        logoUrl,
        password: hashedPassword,
        role: UserRole.SCHOOL_ADMIN,
        createdBy: superAdmin._id,
        superAdmin: superAdmin._id,
      });

      await newSchool.save({ session });

      const populatedSchool = await this.schoolModel
        .findById(newSchool._id)
        .populate('createdBy superAdmin students')
        .exec();

      await session.commitTransaction();


      // Send welcome email via Mailtrap
      await this.emailService.sendSchoolOnboardingEmail(
        newSchool.email,
        tempPassword,
      );

      this.logger.log(
        `School onboarded: ${newSchool.schoolName} by ${superAdmin.email}`,
      );

      return populatedSchool;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error during school onboarding', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAllSchools(): Promise<School[]> {
    try {
      return await this.schoolModel
        .find({ role: UserRole.SCHOOL_ADMIN, deletedAt: null })
        .populate('superAdmin')
        .populate('students')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error('Error fetching schools', error);
      throw error;
    }
  }

  // async deleteSchool(schoolId: number) {
  //   const session = await this.schoolModel.db.startSession();
  //   session.startTransaction();

  //   try {
  //     const school = await this.schoolModel
  //       .findById(schoolId)
  //       .populate('admin users')
  //       .session(session)
  //       .exec();

  //     if (!school) {
  //       throw new NotFoundException(`School with ID ${schoolId} not found`);
  //     }

  //     if (school.users?.length) {
  //       const userIds = school.users.map((user) => user._id);
  //       await this.userModel.updateMany(
  //         { _id: { $in: userIds } },
  //         { deletedAt: new Date() },
  //         { session },
  //       );
  //     }

  //     if (school.admin) {
  //       await this.userModel.findByIdAndUpdate(
  //         school.admin._id,
  //         { deletedAt: new Date() },
  //         { session },
  //       );
  //     }

  //     await this.schoolModel.findByIdAndUpdate(
  //       schoolId,
  //       { deletedAt: new Date() },
  //       { session },
  //     );

  //     await session.commitTransaction();

  //     this.logger.log(`School with ID ${schoolId} deleted successfully`);
  //   } catch (error) {
  //     await session.abortTransaction();
  //     this.logger.error('Error deleting school', error);
  //     throw error;
  //   } finally {
  //     session.endSession();
  //   }
  // }

  async deleteSchool(schoolId: string): Promise<void> {
    const session = await this.schoolModel.db.startSession();
    session.startTransaction();

    try {
      const school = await this.schoolModel.findById(schoolId).session(session);

      if (!school) {
        throw new NotFoundException(`School with ID ${schoolId} not found`);
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

  // async restoreSchool(schoolId: string) {
  //   const session = await this.schoolModel.db.startSession();
  //   session.startTransaction();

  //   try {
  //     await this.schoolModel.findByIdAndUpdate(
  //       schoolId,
  //       { $unset: { deletedAt: 1 } },
  //       { session },
  //     );

  //     await this.userModel.updateMany(
  //       { school: schoolId },
  //       { $unset: { deletedAt: 1 } },
  //       { session },
  //     );

  //     const school = await this.schoolModel.findById(schoolId).session(session);
  //     if (school?.admin) {
  //       await this.userModel.findByIdAndUpdate(
  //         school.admin,
  //         { $unset: { deletedAt: 1 } },
  //         { session },
  //       );
  //     }

  //     await session.commitTransaction();
  //   } catch (error) {
  //     // await session.rollbackTransaction()
  //     throw error;
  //   } finally {
  //     session.endSession();
  //   }
  // }

  async restoreSchool(schoolId: string): Promise<void> {
    const session = await this.schoolModel.db.startSession();
    session.startTransaction();

    try {
      const school = await this.schoolModel.findByIdAndUpdate(
        schoolId,
        { $unset: { deletedAt: 1 } },
        { session, new: true },
      );

      if (!school) {
        throw new NotFoundException(`School with ID ${schoolId} not found`);
      }

      await session.commitTransaction();
      this.logger.log(`School with ID ${schoolId} restored successfully`);
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error restoring school', error);
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
