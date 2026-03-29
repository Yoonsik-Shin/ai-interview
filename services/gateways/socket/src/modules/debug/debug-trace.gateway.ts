import { Server } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";

/**
 * 전용 게이트웨이 대신 InterviewGateway의 서버 인스턴스를 공유하여
 * 실시간 트레이스 이벤트를 관리하는 서비스입니다.
 */
@Injectable()
export class DebugTraceGateway {
    private readonly logger = new Logger(DebugTraceGateway.name);
    private server: Server | null = null;

    /**
     * 메인 게이트웨이에서 서버 인스턴스를 주입받습니다.
     */
    setServer(server: Server): void {
        this.server = server;
        this.logger.log("WebSocket server instance initialized for DebugTraceGateway");
    }

    /**
     * 트레이스 이벤트를 해당 인터뷰 룸에 브로드캐스트
     */
    broadcastTrace(interviewId: string | number, stage: string, data: any): void {
        const idStr = interviewId?.toString();
        if (!idStr) return;

        // 운영 환경 체크 (허용 로직 강화)
        const isProd = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";
        if (isProd) {
            return;
        }

        const room = `debug:trace:${idStr}`;
        const payload = {
            timestamp: Date.now(),
            stage,
            data,
        };

        if (this.server) {
            this.server.to(room).emit("debug:trace", payload);
            this.logger.debug(`Trace broadcasted to room ${room}: ${stage}`);
        } else {
            // 서버 인스턴스가 아직 주입되지 않았을 경우
            this.logger.warn(`Server instance NOT ready. Cannot broadcast trace to room: ${room}`);
        }
    }
}
