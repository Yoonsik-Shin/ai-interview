import { ArgumentsHost, Catch, Logger } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";

@Catch()
export class GlobalWsExceptionFilter extends BaseWsExceptionFilter {
    private readonly logger = new Logger(GlobalWsExceptionFilter.name);

    catch(exception: any, host: ArgumentsHost) {
        const client = host.switchToWs().getClient();
        const data = host.switchToWs().getData();
        const { message, status } = this.getErrorDetails(exception);

        // BFF 스타일 로깅
        const logData = {
            service: "socket",
            event: "exception",
            message,
            data,
            timestamp: new Date().toISOString(),
        };

        if (status === "error") {
            this.logger.error(
                JSON.stringify(logData),
                exception instanceof Error ? exception.stack : undefined,
            );
        } else {
            this.logger.warn(JSON.stringify(logData));
        }

        if (client.emit) {
            client.emit("exception", {
                status,
                message,
            });
        }
    }

    private getErrorDetails(exception: any): { message: string; status: string } {
        if (exception instanceof WsException) {
            return { message: exception.message, status: "warning" };
        }
        if (exception instanceof Error) {
            return { message: exception.message, status: "error" };
        }
        return { message: "서버 내부 오류가 발생했습니다.", status: "error" };
    }
}
