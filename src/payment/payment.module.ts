import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}