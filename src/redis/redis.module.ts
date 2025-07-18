import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}