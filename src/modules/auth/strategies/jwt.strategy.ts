import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/common/interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number; firstName: string; age: number; email: string; role?: UserRole}) {
    console.log(`JWT validation payload: ${JSON.stringify(payload)}`);


    if (!payload.role) {
        throw new UnauthorizedException('Missing role in the token payload');
    }

    return {
      id: payload.sub,
      firstName: payload.firstName,
      age: payload.age,
      email: payload.email,
      role: payload.role,
    };
  }
}
