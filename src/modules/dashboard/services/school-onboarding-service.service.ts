import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { School } from '../../entities/school.entity';
import { Repository } from 'typeorm';
import { User } from '../../entities';
import { LoggerService } from 'src/common/logger/logger.service';
import { PasswordService } from '.';
import { EmailService } from '.';
import { CreateSchoolDto, UserRole } from 'src/common/interfaces';

@Injectable()
export class SchoolOnboardingService {
  constructor(
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly logger: LoggerService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
  ) {}

  async onboardSchool(
    createSchoolDto: CreateSchoolDto,
    superAdmin: User,
  ): Promise<{ school: School; admin: User }> {
    const queryRunner = this.schoolRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const username = this.generateUsername(createSchoolDto.schoolName);
      const tempPassword = this.passwordService.generateRandomPassword();
      const hashedPassword =
        await this.passwordService.hashPassword(tempPassword);

      const adminUser = this.userRepo.create({
        firstName: 'Admin',
        lastName: createSchoolDto.schoolName,
        email: createSchoolDto.email,
        password: hashedPassword,
        role: UserRole.SCHOOL_ADMIN,
      });

      await queryRunner.manager.save(adminUser);

      const school = this.schoolRepo.create({
        schoolName: createSchoolDto.schoolName,
        address: createSchoolDto.address,
        logoUrl: createSchoolDto.logoUrl,
        phoneNumber: createSchoolDto.phoneNumber,
        email: createSchoolDto.email,
        admin: adminUser,
        superAdmin: superAdmin,
      });

      await queryRunner.manager.save(school);

      // updating admin user with school reference
      adminUser.school = school;
      await queryRunner.manager.save(adminUser);

      await queryRunner.commitTransaction();

      await this.emailService.sendSchoolOnboardingEmail(
        createSchoolDto.email,
        username,
        tempPassword,
      );

      return { school, admin: adminUser };
    } catch (error) {
      this.logger.error('Error during school onboarding', error);
      throw error;
    }
  }

  async getAllSchools(): Promise<School[]> {
    try {
      return await this.schoolRepo.find({
        relations: ['admin', 'users', 'superAdmin'],
        order: {
          createdAt: 'DESC',
        },
      });
    } catch (error) {}
  }

  async deleteSchool(schoolId: number) {
    const queryRunner = this.schoolRepo.manager.connection.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const school = await queryRunner.manager.findOne(School, {
        where: { id: schoolId },
        relations: ['admin', 'users'],
        withDeleted: true,
      });

      if (!school) {
        throw new NotFoundException(`School with ID ${schoolId} not found`);
      }

      if (school.users?.length) {
        const userIds = school.users.map((user) => user.id);
        await queryRunner.manager.softDelete(User, userIds);
      }

      if (school.admin) {
        await queryRunner.manager.softDelete(User, { id: school.admin.id });
      }

      await queryRunner.manager.softDelete(School, schoolId);

      await queryRunner.commitTransaction();

      this.logger.log(`School with ID ${schoolId} deleted successfully`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error deleting school', error);
      throw error;
    }
  }

  async restoreSchool(schoolId: number) {
    await this.schoolRepo.restore({ id: schoolId });
    await this.userRepo.restore({ school: { id: schoolId } });
    await this.userRepo.restore({
      id: (
        await this.schoolRepo.findOne({
          where: { id: schoolId },
          select: ['admin'],
        })
      ).admin.id,
    });
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
