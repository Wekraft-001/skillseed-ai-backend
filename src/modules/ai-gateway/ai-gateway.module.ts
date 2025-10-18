import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiGatewayService } from './ai-gateway.service';
import { AiGatewayController } from './ai-gateway.controller';
import { LoggerModule } from '../../common/logger/logger.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    HttpModule.register({
      timeout: 30000, // 30 seconds timeout for AI service calls
      maxRedirects: 2,
    }),
  ],
  controllers: [AiGatewayController],
  providers: [AiGatewayService],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}