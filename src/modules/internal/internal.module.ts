import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { User, UserSchema } from '../schemas';
import { LoggerModule } from '../../common/logger/logger.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [InternalController],
  providers: [InternalService],
  exports: [InternalService],
})
export class InternalModule {}