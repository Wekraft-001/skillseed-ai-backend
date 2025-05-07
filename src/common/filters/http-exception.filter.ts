import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { Response } from "express";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const errorResponse = {
            statusCode: status,
            message: exception.message || 'Something went wrong check well 😔',
            timestamp: new Date().toISOString(),
        };

        console.error(`❌ Error: ${exception.message}`);
        response.status(status).json(errorResponse);
        
    }
}