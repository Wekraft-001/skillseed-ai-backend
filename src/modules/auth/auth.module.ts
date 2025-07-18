import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { LoggerModule } from 'src/common/logger/logger.module';
import { Mentor, MentorSchema, School, SchoolSchema, User, UserSchema } from '../schemas';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { Subscription, SubscriptionSchema } from '../schemas/subscription.schema';
import { GoogleStrategy } from './strategies/googleOauth.strategy';
import googleOauthConfig from 'src/config/google-oauth.config';
import { DashboardModule } from '../dashboard/super_admin/modules';
import { ParentDashboardModule } from '../dashboard/parents/module/dashboard.module';

@Module({
  imports: [
    PassportModule,
    ConfigModule.forFeature(googleOauthConfig),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRESpIN') || '1d',
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Mentor.name, schema: MentorSchema },
      { name: Subscription.name, schema: SubscriptionSchema}
    ]),
    LoggerModule,
    SubscriptionModule,
    ParentDashboardModule
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
})
export class AuthModule {}
