import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";

export class SendAudioDataCommand {
    constructor(
        public readonly server: Server,
        public readonly interviewId: string,
        public readonly sentenceIndex: number,
        public readonly audioData: string,
        public readonly duration: number,
        public readonly persona?: string,
        public readonly text?: string,
    ) {}
}

@Injectable()
export class SendAudioDataUseCase {
    constructor(private readonly logger: SocketLoggingService) {}

    execute(command: SendAudioDataCommand): void {
        const { server, interviewId, sentenceIndex, audioData, duration, persona, text } = command;
        const roomName = `interview-session-${interviewId}`;

        // 로컬 노드에 연결된 클라이언트에게만 전송하여 가로채기 방지 및 브로드캐스트 중복 방지
        (server as any).local.to(roomName).emit("interview:audio", {
            sentenceIndex,
            audioData,
            duration,
            persona,
            text,
        });
    }
}
