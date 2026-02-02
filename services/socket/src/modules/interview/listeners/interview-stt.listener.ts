import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";

@Injectable()
@WebSocketGateway({ cors: { origin: "*" } })
export class InterviewSttListener {
    @WebSocketServer()
    private readonly server: Server;

    constructor(private readonly logger: SocketLoggingService) {}

    @OnEvent("stt.transcript.received")
    handleSttTranscript(payload: { data: any; source: "pubsub" | "stream" }) {
        const { data, source } = payload;
        const interviewSessionId = data?.interviewSessionId || data?.interviewId; // UUID String

        if (!interviewSessionId) {
            this.logger.log(null, "stt_payload_missing_session_id", {
                source,
            });
            return;
        }

        const roomName = `interview-session-${interviewSessionId}`;

        // 클라이언트에게 보낼 이벤트명: "interview:stt_result"
        this.server.to(roomName).emit("interview:stt_result", {
            text: data?.text,
            interviewSessionId,
            timestamp: new Date().toISOString(),
            isFinal: data?.isFinal || false, // isEmpty 등 불명확한 필드 대신 isFinal 사용 권장
            engine: data?.engine || "unknown",
        });

        this.logger.log(null, "stt_text_sent_to_client", {
            interviewSessionId,
            textLength: data?.text?.length || 0,
            roomName,
            source,
            systemLatencyMs:
                data.audioReceivedAt && !isNaN(new Date(data.audioReceivedAt).getTime())
                    ? Date.now() - new Date(data.audioReceivedAt).getTime()
                    : undefined,
        });
    }
}
