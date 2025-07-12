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
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/Redis/redis.service';

@Injectable()
export class SchoolOnboardingService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<School>,
    private readonly logger: LoggerService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
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

      let logoUrl = '';
      if (logoFile) {
        logoUrl = await uploadToAzureStorage(logoFile);
      }

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

      // Storing the password temporarily;
      await this.storeTemporaryPassword(newSchool._id.toString(), tempPassword);

      // Send welcome email via Mailtrap
      // await this.emailService.sendSchoolOnboardingEmail(
      //   newSchool.email,
      //   tempPassword,
      // );

      this.logger.log(
        `School onboarded, payment status pending : ${newSchool.schoolName} by ${superAdmin.email}`,
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

  private async storeTemporaryPassword(
    schoolId: string,
    password: string,
  ): Promise<void> {
    try {
      const key = `temp_password_${schoolId}`;
      const ttlHours =
        this.configService.get<number>('TEMP_PASSWORD_TTL_HOURS') || 24;
      const ttlSeconds = ttlHours * 3600;

      await this.redisService.set(key, password, ttlSeconds);

      this.logger.log(
        `Temporary password stored for school ${schoolId} with TTL: ${ttlHours} hours`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to store temporary password for school ${schoolId}:`,
        error,
      );
      throw new Error('Failed to store temporary password');
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
