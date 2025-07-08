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
import { User, UserDocument, School } from '../schemas';
import { JwtService } from '@nestjs/jwt';
import { LoggerService } from 'src/common/logger/logger.service';
import { UserRole } from 'src/common/interfaces';
import { uploadToAzureStorage } from 'src/common/utils/azure-upload.util';
import { create } from 'domain';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<School>,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
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
        grade: createStudentDto.age,
        imageUrl,
        role: createStudentDto.role,
        password: hashedPassword,
        createdBy: currentUser._id,
        school: currentUser.school,
      });

      await newUser.save({ session });
      await session.commitTransaction();

      const populatedStudent = await this.userModel
        .findById(newUser._id)
        .populate('createdBy school')
        .exec();

      this.logger.log(
        `Student registered: ${newUser.firstName} ${newUser.lastName} by ${currentUser.firstName}`,
      );

      return populatedStudent;
    } catch (error) {
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

  async login1(user: {
    _id: string;
    firstName: string;
    age: number;
    email: string;
    role: UserRole;
  }) {
    const payload = {
      sub: user._id,
      firstName: user.firstName,
      age: user.age,
      email: user.email,
      role: user.role,
    };
    this.logger.setContext('AuthService');
    this.logger.log(`JWT issued for user ${user.email}`);

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '1d' }),
      user: {
        _id: user._id,
        firstName: user.firstName,
        email: user.email,
        role: user.role,
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
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
      },
    };
  }

  async schoolSignin(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    const school = await this.schoolModel
      .findOne({ email })
      .select('+password')
      .lean();

    if (!school) {
      this.logger.warn(
        `School login failed: No school found with email ${email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, school.password);
    if (!isPasswordValid) {
      this.logger.warn(`School login failed: Invalid password for ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (school.role !== UserRole.SCHOOL_ADMIN) {
      this.logger.warn(`School login failed: Invalid role for ${email}`);
      throw new UnauthorizedException('Unauthorized role');
    }

    const payload = {
      sub: school._id,
      email: school.email,
      role: school.role,
      name: school.schoolName,
    };

    this.logger.log(`School ${school.schoolName} logged in successfully`);

    return {
      access_token: this.jwtService.sign(payload),
      school: {
        _id: school._id,
        email: school.email,
        schoolName: school.schoolName,
        role: school.role,
      },
    };
  }
}
