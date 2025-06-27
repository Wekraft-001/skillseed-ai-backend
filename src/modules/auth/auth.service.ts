import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dtos';
import { User, UserDocument } from '../schemas';
import { JwtService } from '@nestjs/jwt';
import { LoggerService } from 'src/common/logger/logger.service';
import { UserRole } from 'src/common/interfaces';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
  ) {}

  async registerUser(createUserDto: CreateUserDto) {
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const newUser = new this.userModel({
        ...createUserDto,
        password: hashedPassword,
        role: createUserDto.role || UserRole.STUDENT,
      });
      const savedUser = await newUser.save();

      return savedUser.toObject();
    } catch (error) {
      this.logger.error('Error registering user', error);
      throw error;
    }
  }

  async signin(firstName: string, password: string) {
    this.logger.setContext('AuthService');

    const user = await this.userModel.findOne({ firstName })
        .select('+password') // Explicitly include password field
        .lean()
        .exec();
    if (!User) {
      this.logger.warn(`Invalid credentials for user: ${firstName}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for user ${firstName}`);
      throw new UnauthorizedException('Invalid credentials: password');
    }

    if (!user.role) {
      this.logger.warn(`User ${firstName} does not have a role assigned`);
      throw new UnauthorizedException('User has not role assigned');
    }

    this.logger.log(`User ${firstName} signed successfully`);
    return this.login(user);
  }

  async login(user: {
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
        role: user.role
      }
    };
  }
}
