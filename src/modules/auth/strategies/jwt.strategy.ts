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
    age: number;
    email: string;
    role?: UserRole;
    school?: School;
    createdBy?: User;
  }) {

    if (!payload.sub) {
      console.log('ERROR: Missing sub in payload');
      throw new UnauthorizedException('Missing user ID in token');
    }

    if (!payload.role) {
      throw new UnauthorizedException('Missing role in the token payload');
    }

    const user = {
      _id: payload.sub,
      firstName: payload.firstName,
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
