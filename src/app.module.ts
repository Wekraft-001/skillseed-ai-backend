import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import {
  Badge,
  EducationalContent,
  User,
  School,
  ProjectShowcase,
} from './modules/schemas';
import { LoggerModule } from './common/logger/logger.module';
import { UserModule } from './modules/users/user.module';
import { AiModule } from './modules/ai/ai.module';
import { SchoolModule } from './modules/dashboard/modules/school.module';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardModule } from './modules/dashboard/modules/dashboard.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        if(!config.MONGO_URI) throw new Error('MONGO_URI is not defined');
        return config;
      }
      // envFilePath: process.env.NODE_ENV === 'production' ? '.env.development',
    }),
    LoggerModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (ConfigService: ConfigService) => ({
        uri: ConfigService.get<string>('MONGO_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    AiModule,
    SchoolModule,
    DashboardModule,
    SubscriptionModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
