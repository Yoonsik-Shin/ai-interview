import { ArgumentsHost, Catch } from "@nestjs/common";
import { BaseWsExceptionFilter } from "@nestjs/websockets";

@Catch()
export class GlobalWsExceptionFilter extends BaseWsExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const client = host.switchToWs().getClient();
        const data = host.switchToWs().getData();
        const error = exception instanceof Error ? exception : new Error(exception);
        // const details = error instanceof Object ? { ...error } : null; // Unused

        // 에러 로깅
        console.error(
            JSON.stringify({
                service: "socket",
                event: "exception",
                message: error.message,
                data,
                timestamp: new Date().toISOString(),
                stack: error.stack,
            }),
        );

        // 클라이언트에게는 안전한 에러 메시지 전송
        // BaseWsExceptionFilter는 기본적으로 emit("exception", ...)을 수행함
        // 하지만 여기서는 직접 핸들링하여 메시지를 sanitization 함

        const message = "서버 내부 오류가 발생했습니다.";

        // 소켓 연결이 살아있는 경우 에러 이벤트 전송
        if (client.emit) {
            client.emit("exception", {
                status: "error",
                message: message, // 상세 에러 숨김
            });
        }
    }
}
