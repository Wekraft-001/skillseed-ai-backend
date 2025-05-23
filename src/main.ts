import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerService } from './common/logger/logger.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe());
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const apiPrefix = 'api';
  app.setGlobalPrefix(apiPrefix);

  const loggerService = await app.resolve(LoggerService);

  app.useGlobalInterceptors(new LoggingInterceptor(loggerService));
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
