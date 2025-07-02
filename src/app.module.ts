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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        if(!config.MONGODB_URI) throw new Error('MONGODB_URI is not defined');
        return config;
      }
    }),
    LoggerModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    AiModule,
    SchoolModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
