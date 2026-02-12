import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";

export class SendSttResultCommand {
    constructor(
        public readonly server: Server,
        public readonly interviewSessionId: string,
        public readonly text: string,
        public readonly isFinal: boolean,
        public readonly engine: string,
        public readonly source: string,
        public readonly audioReceivedAt?: string,
    ) {}
}

@Injectable()
export class SendSttResultUseCase {
    constructor(private readonly logger: SocketLoggingService) {}

    async execute(command: SendSttResultCommand): Promise<void> {
        const { server, interviewSessionId, text, isFinal, engine, source, audioReceivedAt } =
            command;
        const roomName = `interview-session-${interviewSessionId}`;

        // 클라이언트에게 보낼 이벤트명: "interview:stt_result"
        server.to(roomName).emit("interview:stt_result", {
            text,
            interviewSessionId,
            timestamp: new Date().toISOString(),
            isFinal,
            engine,
        });

        this.logger.log(null, "stt_text_sent_to_client", {
            interviewSessionId,
            textLength: text?.length || 0,
            roomName,
            source,
            systemLatencyMs:
                audioReceivedAt && !isNaN(new Date(audioReceivedAt).getTime())
                    ? Date.now() - new Date(audioReceivedAt).getTime()
                    : undefined,
        });
    }
}
