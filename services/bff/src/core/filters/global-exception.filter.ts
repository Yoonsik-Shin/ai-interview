import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
    Injectable,
} from "@nestjs/common";
import { Request, Response } from "express";

/** 전역 예외 처리 필터 */
@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const { status, message } = this.getErrorDetails(exception);
        const traceId = request.traceId;

        this.logError(request, status, message, exception, traceId);

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
        });
    }

    private getErrorDetails(exception: unknown): { status: number; message: string } {
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            const message =
                typeof exceptionResponse === "string"
                    ? exceptionResponse
                    : (exceptionResponse as any).message || exception.message;

            return { status, message };
        }

        if (exception instanceof Error) {
            return {
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                message: exception.message,
            };
        }

        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: "서버 내부 오류가 발생했습니다.",
        };
    }

    private logError(
        request: Request,
        status: number,
        message: string,
        exception: unknown,
        traceId?: string,
    ) {
        const logMessage = `[${request.method}] ${request.url} ${status} - ${message} (TraceID: ${traceId})`;
        if (status >= 500) {
            this.logger.error(logMessage, exception instanceof Error ? exception.stack : undefined);
        } else {
            this.logger.warn(logMessage);
        }
    }
}
