import { Injectable } from "@nestjs/common";
import type { Socket } from "socket.io";

/**
 * Socket 서비스 전용 로깅 서비스
 *
 * - 공통 JSON 포맷을 유지하면서, 게이트웨이 코드에서 로깅 로직을 분리합니다.
 * - AOP 스타일로 cross-cutting concern(로깅)을 한 곳에 모으는 역할입니다.
 */
@Injectable()
export class SocketLoggingService {
    log(client: Socket | null, event: string, fields: Record<string, unknown> = {}): void {
        this.print("info", client, event, fields);
    }

    debug(client: Socket | null, event: string, fields: Record<string, unknown> = {}): void {
        this.print("debug", client, event, fields);
    }

    warn(client: Socket | null, event: string, fields: Record<string, unknown> = {}): void {
        this.print("warn", client, event, fields);
    }

    error(client: Socket | null, message: string, fields: Record<string, unknown> = {}): void {
        this.print("error", client, "error_occurred", { message, ...fields });
    }

    private print(
        level: string,
        client: Socket | null,
        event: string,
        fields: Record<string, unknown>,
    ): void {
        const now = new Date().toISOString();
        const traceId = client ? (client as any).traceId : undefined;
        const userId = client ? (client as any).userId : undefined;
        const clientId = client ? client.id : undefined;

        console.log(
            JSON.stringify(
                {
                    service: "socket",
                    level,
                    event,
                    traceId,
                    userId,
                    clientId,
                    timestamp: now,
                    ...fields,
                },
                null,
                0,
            ),
        );
    }
}
