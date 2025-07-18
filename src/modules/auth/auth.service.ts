import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateAdminOrParentDto, CreateStudentDto } from './dtos';
import { User, UserDocument, School, Mentor } from '../schemas';
import { JwtService } from '@nestjs/jwt';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  PaymentStatus,
  SubscriptionStatus,
  UserRole,
} from 'src/common/interfaces';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { Subscription } from 'rxjs';
import { SubscriptionDocument } from '../schemas/subscription.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<School>,
    @InjectModel(Mentor.name)
    private readonly mentorModel: Model<Mentor>,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
    private readonly subscriptionService: SubscriptionService,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async registerAdminOrParent(createDto: CreateAdminOrParentDto) {
    if (![UserRole.SUPER_ADMIN, UserRole.PARENT].includes(createDto.role)) {
      throw new BadRequestException(
        'Only SUPER_ADMIN or PARENT can self-register',
      );
    }

    const session: ClientSession = await this.userModel.db.startSession();

    let existing;
    let newUser;

    try {
      existing = await this.userModel.findOne({ email: createDto.email });
      if (existing) {
        throw new ConflictException('Email already in use');
      }

      await session.withTransaction(async () => {
        const hashedPassword = await bcrypt.hash(createDto.password, 10);
        newUser = new this.userModel({
          ...createDto,
          password: hashedPassword,
        });
        await newUser.save({ session });
      });

      return newUser.toObject();
    } catch (error) {
      this.logger.error('Error registering user', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async registerStudent(
    createStudentDto: CreateStudentDto,
    currentUser: User | School,
    image?: Express.Multer.File,
  ) {
    if (
      ![UserRole.PARENT, UserRole.SCHOOL_ADMIN].includes(
        currentUser.role as UserRole,
      )
    ) {
      throw new BadRequestException(
        'Only School Admin or Parent can add student',
      );
    }

    if (currentUser.role === UserRole.PARENT) {
      const canAddChild = await this.subscriptionService.canAddChild(
        currentUser._id.toString(),
      );
      if (!canAddChild) {
        throw new BadRequestException(
          'Please complete payment for this child before registering them.',
        );
      }
    }

    const session: ClientSession = await this.userModel.db.startSession();

    try {
      const hashedPassword = await bcrypt.hash(createStudentDto.password, 10);

      let imageUrl = '';
      if (image) {
        imageUrl = await uploadToAzureStorage(image);
      }

      session.startTransaction();

      const schoolId =
        currentUser.role === UserRole.SCHOOL_ADMIN
          ? (currentUser as School)._id
          : (currentUser as User).school;

      if (currentUser.role === UserRole.SCHOOL_ADMIN) {
        const school = currentUser as School;

        if (
          school.studentsLimit !== null &&
          school.studentsLimit !== undefined
        ) {
          const currentStudentCount = await this.userModel.countDocuments({
            school: schoolId,
            role: UserRole.STUDENT,
            deletedAt: null,
          });

          if (currentStudentCount >= school.studentsLimit) {
            throw new BadRequestException(
              `Cannot add more students. School has reached its maximum of ${school.studentsLimit} students. Please purchase additional student slots to add more students`,
            );
          }
        }
      }

      const newUser = new this.userModel({
        firstName: createStudentDto.firstName,
        lastName: createStudentDto.lastName,
        age: createStudentDto.age,
        grade: createStudentDto.grade,
        imageUrl,
        role: createStudentDto.role,
        password: hashedPassword,
        createdBy:
          currentUser.role === UserRole.SCHOOL_ADMIN
            ? (currentUser as School).createdBy
            : (currentUser as User)._id,
        school: (currentUser as User).school,
      });

      await newUser.save({ session });

      await this.schoolModel.findByIdAndUpdate(
        schoolId,
        {
          $push: { students: newUser._id },
        },
        { session },
      );

      if (currentUser.role === UserRole.PARENT) {
        const childId = newUser._id.toString();
        // const parentId = (currentUser as User)._id.toString();

        const canAdd = await this.subscriptionService.canAddChild(
          currentUser._id.toString(),
        );
        if (!canAdd) {
          throw new BadRequestException(
            'Cannot add child. Please complete payment for this child before registering them.',
          );
        }

        if(!createStudentDto.childTempId) {
          throw new BadRequestException('Missing childTempId. Cannot link to subscription')
        }

        await this.subscriptionService.addChildToSubscription(
          currentUser._id.toString(),
          childId,
          createStudentDto.childTempId,
          session,
        );

        await this.subscriptionService.incrementChildrenCount(
          currentUser._id.toString(),
        );
      }

      await session.commitTransaction();

      const populatedStudent = await this.userModel
        .findById(newUser._id)
        .populate('createdBy')
        // .populate('subscription')
        .exec();

      this.logger.log(
        `Student registered: ${newUser.firstName} ${newUser.lastName} by ${
          currentUser.role === UserRole.SCHOOL_ADMIN
            ? (currentUser as School).schoolName
            : (currentUser as User).firstName
        }`,
      );

      return populatedStudent;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  async childLogin(credentials: { firstName: string; password: string }) {
    const childUser = await this.userModel
      .findOne({ firstName: credentials.firstName })
      .select('+password')
      .lean();

    if (
      !childUser ||
      !(await bcrypt.compare(credentials.password, childUser.password))
    ) {
      throw new UnauthorizedException('Invalid credentails');
    }

    const payload = {
      sub: childUser._id,
      firstName: childUser.firstName,
      lastName: childUser.lastName,
      age: childUser.age,
      grade: childUser.grade,
      school: childUser.school,
      createdBy: childUser.createdBy,
      role: childUser.role,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '1d' }),
      user: {
        _id: childUser._id,
        firstName: childUser.firstName,
        lastName: childUser.lastName,
        age: childUser.age,
        grade: childUser.grade,
        school: childUser.school,
        role: childUser.role,
        createdBy: childUser.createdBy,
      },
    };
  }

  async login(credentials: { email: string; password: string }) {
    const user = await this.userModel
      .findOne({ email: credentials.email })
      .select('+password')
      .lean();

    if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user._id,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      school: user.school,
      createdBy: user.createdBy,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        school: user.school,
        role: user.role,
        createdBy: user.createdBy,
      },
    };
  }

  async schoolSignin(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    const schoolAdmin = await this.schoolModel
      .findOne({ email, role: UserRole.SCHOOL_ADMIN })
      .populate('createdBy')
      .select('+password')
      .lean();

    if (!schoolAdmin) {
      this.logger.warn(
        `School login failed: No school found with email ${email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      schoolAdmin.password,
    );
    if (!isPasswordValid) {
      this.logger.warn(`School login failed: Invalid password for ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: schoolAdmin._id,
      schoolName: schoolAdmin.schoolName,
      email: schoolAdmin.email,
      role: schoolAdmin.role,
      studentsLimit: schoolAdmin.studentsLimit,
      name: schoolAdmin.schoolName,
      createdBy: schoolAdmin.createdBy,
      school: schoolAdmin._id,
    };

    this.logger.log(`School ${schoolAdmin.schoolName} logged in successfully`);

    return {
      access_token: this.jwtService.sign(payload),
      user: schoolAdmin,
    };
  }

  async mentorSignin(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    const mentor = await this.mentorModel
      .findOne({ email, role: UserRole.MENTOR })
      .populate('createdBy')
      .select('+password')
      .lean();

    if (!mentor) {
      this.logger.warn(
        `Mentor login failed: No school found with email ${email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, mentor.password);
    if (!isPasswordValid) {
      this.logger.warn(`Mentor login failed: Invalid password for ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: mentor._id,
      email: mentor.email,
      role: mentor.role,
      name: mentor.firstName,
      createdBy: mentor.createdBy,
    };

    this.logger.log(`Mentor ${mentor.firstName} logged in successfully`);

    return {
      access_token: this.jwtService.sign(payload),
      user: mentor,
    };
  }
}
