import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";

export class SendTranscriptCommand {
    constructor(
        public readonly server: Server,
        public readonly interviewId: string,
        public readonly payload: any,
    ) {}
}

@Injectable()
export class SendTranscriptUseCase {
    async execute(command: SendTranscriptCommand): Promise<void> {
        const { server, interviewId, payload } = command;
        const room = `interview-session-${interviewId}`;

        if (payload.type === "STAGE_CHANGE") {
            server.to(room).emit("interview:stage_changed", {
                currentStage: payload.currentStage,
                previousStage: payload.previousStage,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "INTERVENE") {
            server.to(room).emit("interview:intervene", {
                message: payload.content || "Intervention requested",
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "RETRY_ANSWER") {
            server.to(room).emit("interview:retry_answer", {
                message: payload.content || "Please repeat",
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "token" || payload.type === "TRANSCRIPT" || !payload.type) {
            server.to(room).emit("interview:transcript", {
                type: "token",
                content: payload.content || payload.token,
                thinking: payload.thinking,
                reduceTotalTime: payload.reduceTotalTime,
                nextDifficulty: payload.nextDifficulty,
                currentPersonaId: payload.currentPersonaId,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "clear_turn") {
            server.to(room).emit("interview:transcript", {
                type: "clear_turn",
                turn_count: payload.turnCount || payload.turn_count,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "turn_complete") {
            server.to(room).emit("interview:transcript", {
                type: "turn_complete",
                turn_count: payload.turnCount || payload.turn_count,
                timestamp: payload.timestamp,
            });
        } else {
            // 기타 알 수 없는 이벤트들은 그대로 통과
            server.to(room).emit("interview:transcript", payload);
        }
    }
}
