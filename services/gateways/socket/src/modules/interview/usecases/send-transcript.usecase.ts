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
    execute(command: SendTranscriptCommand): void {
        const { server, interviewId, payload } = command;
        const room = `interview-session-${interviewId}`;

        if (payload.type === "STAGE_CHANGE") {
            console.log(`[SocketServer] Emitting stage_changed to room ${room}: ${payload.currentStage}`);
            server.local.to(room).emit("interview:stage_changed", {
                currentStage: payload.currentStage,
                previousStage: payload.previousStage,
                selfIntroRetryCount: payload.selfIntroRetryCount,
                selfIntroElapsedSeconds: payload.selfIntroElapsedSeconds,
                isMaxRetryExceeded: payload.isMaxRetryExceeded,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "turn_state") {
            server.local.to(room).emit("interview:turn_state", {
                stage: payload.currentStage || payload.stage,
                status: payload.status,
                canCandidateSpeak: Boolean(payload.canCandidateSpeak),
                turnCount: payload.turnCount ?? 0,
                activePersonaId: payload.activePersonaId || payload.currentPersonaId,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "INTERVENE") {
            // [지연 최적화] AI 답변 생성 중 발생하는 자동 필러 음성(INTERVENE)은 사용자 경험을 저해하므로 비활성화합니다.
            // 수동으로 트리거되는 '건너뛰기' 알림 등은 Gateway에서 직접 처리하므로 이 코드는 필러 오디오 전용입니다.
            /*
            server.local.to(room).emit("interview:intervene", {
                message: payload.content || "Intervention requested",
                timestamp: payload.timestamp,
            });
            */
        } else if (payload.type === "RETRY_ANSWER") {
            server.local.to(room).emit("interview:retry_answer", {
                message: payload.content || "Please repeat",
                selfIntroRetryCount: payload.selfIntroRetryCount,
                selfIntroElapsedSeconds: payload.selfIntroElapsedSeconds,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "timer_sync") {
            console.log(`[SocketServer] Emitting timer_sync to room ${room}: ${payload.timeLeft as number}s`);
            server.local.to(room).emit("interview:timer_sync", {
                timeLeft: payload.timeLeft,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "token" || payload.type === "TRANSCRIPT" || !payload.type) {
            server.local.to(room).emit("interview:transcript", {
                type: "token",
                token: payload.token || payload.content,
                isFinal: payload.isFinal || payload.is_final,
                thinking: payload.thinking,
                reduceTotalTime: payload.reduceTotalTime,
                nextDifficulty: payload.nextDifficulty,
                currentPersonaId: payload.currentPersonaId,
                turnCount: payload.turnCount ?? 0,
                timeLeft: payload.timeLeft,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "clear_turn") {
            server.local.to(room).emit("interview:transcript", {
                type: "clear_turn",
                turnCount: payload.turnCount ?? payload.turn_count ?? 0,
                timestamp: payload.timestamp,
            });
        } else if (payload.type === "turn_complete") {
            server.local.to(room).emit("interview:transcript", {
                type: "turn_complete",
                turnCount: payload.turnCount ?? payload.turn_count ?? 0,
                timestamp: payload.timestamp,
            });
        } else {
            // 기타 알 수 없는 이벤트들은 그대로 통과
            server.local.to(room).emit("interview:transcript", payload);
        }
    }
}
