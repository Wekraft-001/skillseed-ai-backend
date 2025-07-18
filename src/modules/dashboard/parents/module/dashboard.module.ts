import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParentDashboardService } from '../services/dashboard.service';
import { ParentDashboardController } from '../controllers/dashboard.controller';
import { School, SchoolSchema, User, UserSchema } from '../../../schemas/index';
import { LoggerModule } from 'src/common/logger/logger.module';
import { Subscription } from 'rxjs';
import { SubscriptionSchema } from 'src/modules/schemas/subscription.schema';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    LoggerModule,
    SubscriptionModule,
  ],
  controllers: [ParentDashboardController],
  providers: [ParentDashboardService],
})
export class ParentDashboardModule {}
