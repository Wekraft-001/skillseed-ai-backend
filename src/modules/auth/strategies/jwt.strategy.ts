import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/common/interfaces';
import { School, User } from 'src/modules/schemas';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: number;
    firstName: string;
    lastName: string;
    age: number;
    email: string;
    role?: UserRole;
    school?: School;
    schoolName?: string;
    studentsLimit?: number;
    phoneNumber?: number;
    createdBy?: User;
  }) {
    if (!payload.sub) {
      console.log('ERROR: Missing sub in payload');
      throw new UnauthorizedException('Missing user ID in token');
    }

    if (!payload.role) {
      throw new UnauthorizedException('Missing role in the token payload');
    }

    if (payload.role === UserRole.SCHOOL_ADMIN) {
      return {
        _id: payload.sub,
        email: payload.email,
        role: payload.role,
        schoolName: payload.schoolName,
        studentsLimit: payload.studentsLimit,
        createdBy: payload.createdBy,
        school: payload.school,
      };
    } else if(payload.role === UserRole.PARENT) {
      return {
        _id: payload.sub,
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName,
        lastName: payload.lastName,
        poneNumber: payload.phoneNumber,
        createdBy: payload.createdBy,
        school: payload.school,
      }
    }

    const user = {
      _id: payload.sub,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phoneNumber: payload.phoneNumber,
      age: payload.age,
      email: payload.email,
      school: payload.school,
      role: payload.role,
      createdBy: payload.createdBy,
    };
    console.log(`Returning user object: ${JSON.stringify(user)}`);
    return user;
  }
}
