import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchoolDashboardService } from '../services/index';
import { SchoolDashboardController } from '../controller/dashboard.controller';
import { School, SchoolSchema, User, UserSchema } from '../../../schemas/index';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
    ]),
    LoggerModule,
  ],
  controllers: [SchoolDashboardController],
  providers: [SchoolDashboardService],
})
export class SchoolDashboardModule {}
