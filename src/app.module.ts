import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';

import {
  Badge,
  EducationalContent,
  User,
  School,
  ProjectShowcase,
  Mentor,
} from './modules/schemas';
import { LoggerModule } from './common/logger/logger.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { InternalModule } from './modules/internal/internal.module';
import {
  DashboardModule,
  SchoolModule,
  TransactionModule,
  MentorModule,
  CommunityModule,
} from './modules/dashboard/super_admin/modules/index';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionModule } from './subscription/subscription.module';
import { RedisModule } from './redis/redis.module';
import { PaymentModule } from './payment/payment.module';
import { SchoolDashboardModule } from './modules/dashboard/school_admin/modules/dashboard.module';
import { ParentDashboardModule } from './modules/dashboard/parents/module/dashboard.module';
import { MentorDashboardModule } from './modules/dashboard/mentors/module/dashboard.module';
import { StudentDashboardModule } from './modules/dashboard/student/module/dashboard.module';
import { ContentModule } from './modules/content/content.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        if (!config.MONGO_URI) throw new Error('MONGO_URI is not defined');
        return config;
      },
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
    AiGatewayModule,
    InternalModule,
    SchoolModule,
    MentorModule,
    CommunityModule,
    SchoolDashboardModule,
    ParentDashboardModule,
    MentorDashboardModule,
    StudentDashboardModule,
    DashboardModule,
    SubscriptionModule,
    RedisModule,
    TransactionModule,
    PaymentModule,
    ContentModule,
    RewardsModule,
    ReportsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
