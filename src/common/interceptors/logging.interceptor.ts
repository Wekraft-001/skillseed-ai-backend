import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {

    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;

    const contextName = `${method} ${url}`;
    this.logger.setContext('HTTP');

    this.logger.log(`Incoming Request: ${contextName}`);
    this.logger.debug(`Request Body: ${JSON.stringify(body)}`);

    const now = Date.now();
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log(`Response Sent: ${contextName} - ${duration}ms`);
      }),
      catchError((error) => {
        const duration = Date.now() - now;
        const message = error?.message || 'Unknown error';
        const status = error?.status || 500;

        this.logger.error(`❌ ${contextName} - ${status} - ${duration}ms - ${message}`, error.stack);
        
        return throwError(() => error);
      }),
    );
  }
}
