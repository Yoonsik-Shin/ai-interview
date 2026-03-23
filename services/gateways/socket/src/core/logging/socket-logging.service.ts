import { Injectable, Logger } from "@nestjs/common";
import { AuthenticatedSocket } from "../../types/socket.types";

/**
 * Socket 서비스 전용 로깅 서비스
 *
 * - 공통 JSON 포맷을 유지하면서, 게이트웨이 코드에서 로깅 로직을 분리합니다.
 * - AOP 스타일로 cross-cutting concern(로깅)을 한 곳에 모으는 역할입니다.
 */
@Injectable()
export class SocketLoggingService {
    private readonly logger = new Logger(SocketLoggingService.name);

    log(
        client: AuthenticatedSocket | null,
        event: string,
        fields: Record<string, unknown> = {},
    ): void {
        this.print("info", client, event, fields);
    }

    warn(
        client: AuthenticatedSocket | null,
        event: string,
        fields: Record<string, unknown> = {},
    ): void {
        this.print("warn", client, event, fields);
    }

    error(
        client: AuthenticatedSocket | null,
        message: string,
        fields: Record<string, unknown> = {},
    ): void {
        this.print("error", client, "error_occurred", { message, ...fields });
    }

    debug(): void {
        // Debug logs removed as per request
    }

    private print(
        level: string,
        client: AuthenticatedSocket | null,
        event: string,
        fields: Record<string, unknown>,
    ): void {
        const traceId = client?.data?.traceId;
        const userId = client?.data?.userId;
        const clientId = client?.id;

        const logPayload = {
            service: "socket",
            event,
            traceId,
            userId,
            clientId,
            ...fields,
        };

        const message = JSON.stringify(logPayload);

        switch (level) {
            case "warn":
                this.logger.warn(message);
                break;
            case "error":
                this.logger.error(message);
                break;
            case "info":
            default:
                this.logger.log(message);
                break;
        }
    }
}
