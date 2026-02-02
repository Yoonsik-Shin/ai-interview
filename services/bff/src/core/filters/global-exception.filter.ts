import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";

/** 전역 예외 처리 필터 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = "서버 내부 오류가 발생했습니다.";

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === "string") {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
                message = (exceptionResponse as any).message || exception.message;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        const traceId = (request as any).traceId;

        // 에러 로깅 (JSON 형식)
        console.error(
            JSON.stringify({
                service: "bff",
                event: "exception",
                traceId,
                path: request.url,
                method: request.method,
                status,
                message: message, // 로그에는 원본 메시지 기록
                timestamp: new Date().toISOString(),
                stack: exception instanceof Error ? exception.stack : undefined,
            }),
        );

        // 500 에러인 경우 클라이언트에게는 일반적인 메시지 전달 (보안)
        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            message = "서버 내부 오류가 발생했습니다.";
        }

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
        });
    }
}
