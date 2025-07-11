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
import { UserRole } from 'src/common/interfaces';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { SubscriptionService } from 'src/subscription/subscription.service';

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
  ) {
    this.logger.setContext(AuthService.name);
  }

  async registerAdminOrParent(createDto: CreateAdminOrParentDto) {
    if (![UserRole.SUPER_ADMIN, UserRole.PARENT].includes(createDto.role)) {
      throw new BadRequestException(
        'Only SUPER_ADMIN or PARENT can self-register',
      );
    }

    const existing = await this.userModel.findOne({ email: createDto.email });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    try {
      const hashedPassword = await bcrypt.hash(createDto.password, 10);
      const newUser = new this.userModel({
        ...createDto,
        password: hashedPassword,
        // role: createDto.role || UserRole.STUDENT,
      });
      const savedUser = await newUser.save();

      return savedUser.toObject();
    } catch (error) {
      this.logger.error('Error registering user', error);
      throw error;
    }
  }

  async registerStudent(
    createStudentDto: CreateStudentDto,
    currentUser: User,
    image?: Express.Multer.File,
  ) {
    if (![UserRole.PARENT, UserRole.SCHOOL_ADMIN].includes(currentUser.role)) {
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
          'You need an active subscription to add children or you have reached the maximum limit (30 children). Please purchase a subscription or wait for your current subscription to renew.',
        );
      }
    }

    const session: ClientSession = await this.userModel.db.startSession();

    try {
      session.startTransaction();

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
        role: createStudentDto.role,
        password: hashedPassword,
        createdBy: currentUser._id,
        school: currentUser.school,
      });

      await newUser.save({ session });

      await this.schoolModel.findByIdAndUpdate(
        currentUser.school,
        { $push: { students: newUser._id } },
        { session },
      );

      if (currentUser.role === UserRole.PARENT) {
        await this.subscriptionService.incrementChildrenCount(
          currentUser._id.toString(),
        );
      }

      await session.commitTransaction();

      const populatedStudent = await this.userModel
        .findById(newUser._id)
        .populate('createdBy')
        .populate('school')
        .exec();

      this.logger.log(
        `Student registered: ${newUser.firstName} ${newUser.lastName} by ${currentUser.firstName}`,
      );

      console.log('Current user:', currentUser);
      console.log('Current user school:', currentUser.school);

      return populatedStudent;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error registering student', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // async signin(firstName: string, password: string) {
  //   this.logger.setContext('AuthService');

  //   const user = await this.userModel
  //     .findOne({ firstName })
  //     .select('+password') // Explicitly include password field
  //     .lean()
  //     .exec();

  //   if (!user) {
  //     this.logger.warn(`Invalid credentials for user: ${firstName}`);
  //     throw new UnauthorizedException('Invalid credentials');
  //   }

  //   const isPasswordValid = await bcrypt.compare(password, user.password);
  //   if (!isPasswordValid) {
  //     this.logger.warn(`Invalid password attempt for user ${firstName}`);
  //     throw new UnauthorizedException('Invalid credentials: password');
  //   }

  //   if (!user.role) {
  //     this.logger.warn(`User ${firstName} does not have a role assigned`);
  //     throw new UnauthorizedException('User has not role assigned');
  //   }

  //   this.logger.log(`User ${firstName} signed successfully`);
  //   // return this.login(user);
  //   return this.login({
  //     ...user,
  //     _id: user._id.toString(),
  //   });
  // }

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
      email: schoolAdmin.email,
      role: schoolAdmin.role,
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
