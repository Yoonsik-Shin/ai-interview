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
        } else {
            server.to(room).emit("interview:transcript", {
                token: payload.token,
                thinking: payload.thinking,
                reduceTotalTime: payload.reduceTotalTime,
                nextDifficulty: payload.nextDifficulty,
                currentPersonaId: payload.currentPersonaId,
                timestamp: payload.timestamp,
            });
        }
    }
}
