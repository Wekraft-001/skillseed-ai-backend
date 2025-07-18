import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession, Types } from 'mongoose';
import { Mentor } from 'src/modules/schemas';
import { CreateMentorDto, UserRole } from 'src/common/interfaces';
import { User } from 'src/modules/schemas';
import { PasswordService } from '../../super_admin/services/password-service.service';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { EmailService } from 'src/common/utils/mailing/email.service';

@Injectable()
export class MentorOnboardingService {
  private readonly logger = new Logger(MentorOnboardingService.name);

  constructor(
    @InjectModel(Mentor.name)
    private readonly mentorModel: Model<Mentor>,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
  ) {}

  async onboardMentor(
    createMentorDto: CreateMentorDto,
    superAdmin: User,
    imageFile?: Express.Multer.File,
  ): Promise<Mentor> {
    const session: ClientSession = await this.mentorModel.db.startSession();

    try {
      session.startTransaction();

      // Generate and hash password
      const tempPassword = this.passwordService.generateRandomPassword();
      const hashedPassword =
        await this.passwordService.hashPassword(tempPassword);

      // Upload profile image to Azure
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadToAzureStorage(imageFile);
      }

      // Create mentor document
      const newMentor = new this.mentorModel({
        firstName: createMentorDto.firstName,
        lastName: createMentorDto.lastName,
        email: createMentorDto.email,
        phoneNumber: createMentorDto.phoneNumber,
        specialty: createMentorDto.specialty,
        city: createMentorDto.city,
        country: createMentorDto.country,
        image: imageUrl,
        role: UserRole.MENTOR,
        password: hashedPassword,
        createdBy: superAdmin._id,
      });

      await newMentor.save({ session });

      const populatedMentor = await this.mentorModel
        .findById(newMentor._id)
        .populate('createdBy superAdmin students')
        .exec();

      await session.commitTransaction();

      // Send welcome email
      await this.emailService.sendMentorOnboardingEmail(
        newMentor.firstName,
        newMentor.email,
        tempPassword,
      );

      this.logger.log(
        `Mentor onboarded: ${newMentor.firstName} ${newMentor.lastName} by ${superAdmin.email}`,
      );

      return populatedMentor;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error during mentor onboarding', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAllMentors(): Promise<Mentor[]> {
    try {
      return await this.mentorModel
        .find({ role: UserRole.MENTOR, deletedAt: null })
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error('Error fetching schools', error);
      throw error;
    }
  }
}
