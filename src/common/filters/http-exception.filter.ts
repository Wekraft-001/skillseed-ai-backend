import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponse } from '../interfaces';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    // const status = exception.getStatus();

    const errorResponse: ErrorResponse = {
      statusCode: 500,
      message: 'Something went wrong check well 😔',
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    if (exception instanceof HttpException) {
      errorResponse.statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorResponse.message = exceptionResponse;
      } else {
        errorResponse.message = (exceptionResponse as any).message || exception.message;
        if((exceptionResponse as any).errors) {
            errorResponse.errors = (exceptionResponse as any).errors;
        }
      }

    } else if (exception instanceof Error) {
      errorResponse.message = exception.message;
      errorResponse.stack =
        process.env.NODE_ENV === 'production' ? exception.stack : undefined;
    }

    // additional loggin for non-production environments
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.body = request.body;
      errorResponse.query = (request as any).query;
      errorResponse.user = (request as any).user; // Assuming user is attached to request
    }


    console.error('\n Exception Details: ');
    console.error(`⏱️  Timestamp: ${errorResponse.timestamp}`);
    console.error(`🔗 Path: ${request.method} ${request.url}`);
    console.error(`💬 Message: ${errorResponse.message}`);
    if (errorResponse.stack) {
      console.error(`🗂️ Stack Trace: ${errorResponse.stack}`);
    }
    console.error('📦 Request Body:', request.body);
    console.error('🔍 Query Params:', (request as any).query);
    console.error('🆔 User:', (request as any).user);

    response.status(errorResponse.statusCode).json(errorResponse);
  }
}
