import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  StrategyOptions,
  VerifyCallback,
} from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { ConfigType } from '@nestjs/config';
import googleOauthConfig from 'src/config/google-oauth.config';
import { profile } from 'console';
import { UserRole } from 'src/common/interfaces';
import { CreateAdminOrParentDto, CreateOAuthUserDto } from '../dtos';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/modules/schemas';
import { Model } from 'mongoose';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private googleConfiguration: ConfigType<typeof googleOauthConfig>,
    private authService: AuthService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private logger: LoggerService,
  ) {
    super({
      clientID: googleConfiguration.clientID,
      clientSecret: googleConfiguration.clientSecret,
      callbackURL: googleConfiguration.callbackURL,
      scope: ['email', 'profile'],
      prompt: 'select_account',
    } as StrategyOptions);
  }

  async validate(
    access_token: string,
    refress_token: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      this.logger.log('Validating Google OAuth user', profile);
      console.log('Google email:', profile.emails?.[0]?.value);
      console.log('Google ID:', profile.id);

      if (!profile.id) {
        console.error('Google profile ID is missing');
        return done(new Error('Google profile ID is missing'), null);
      }

      if (!profile.emails || !profile.emails[0]?.value) {
        console.error('Google profile email is missing');
        return done(new Error('Google profile email is missing'), null);
      }

      const googleUserData: CreateOAuthUserDto = {
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        role: UserRole.PARENT,
      };

      const user = await this.validateUser(googleUserData);

      if (!user) {
        return done(new Error('Failed to validate user'), null);
      }

      return done(null, user);
    } catch (error) {
      this.logger.error('Error in Google OAuth validation: ', error);
      return done(error, null);
    }
  }

  async validateUser(googleUser: CreateOAuthUserDto) {
    const user = await this.userModel.findOne({ email: googleUser.email });

    if (user) return user;

    const dto: CreateAdminOrParentDto = {
      ...googleUser,
      phoneNumber: googleUser.phoneNumber ?? 0,
      password: crypto.randomUUID(), // will be ignored if isOauth in authService is true for register parent
    };

    return await this.authService.registerAdminOrParent(dto, true); // true here I'm flaging the registered parent is using OAuth
  }
}
