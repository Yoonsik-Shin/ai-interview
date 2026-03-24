import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import type { SocketConnectedEvent, SocketDisconnectedEvent } from "src/modules/modules.interface";
import { ConnectionEventType } from "../../modules.enum";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../../infra/grpc/services/interview-grpc.service";
import { RedisClient } from "../../../infra/redis/redis.clients";

@Injectable()
export class InterviewConnectionListener {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly stageService: InterviewGrpcService,
        private readonly redisClient: RedisClient,
    ) {}

    @OnEvent("socket.connected")
    async handleInterviewStart(event: SocketConnectedEvent) {
        const { client } = event;
        const { query } = client.data;

        // 1. 타입 체크: Interview 연결이 아니면 무시
        if (query.type !== ConnectionEventType.Interview) {
            return;
        }

        // 2. ID 누락 체크: Interview 타입인데 ID가 없으면 에러
        if (!query.interviewId) {
            this.logger.log(client, "interview_id_missing");
            client.emit("connection:error", {
                code: "MISSING_INTERVIEW_ID",
                message: "Missing interviewId for interview connection",
            });
            client.disconnect();
            return;
        }

        if (Array.isArray(query.interviewId)) {
            this.logger.log(client, "interview_id_duplicated", {
                interviewId: query.interviewId,
            });
            client.emit("connection:error", {
                code: "DUPLICATE_INTERVIEW_ID",
                message: "Duplicate interviewId parameter",
            });
            client.disconnect();
            return;
        }

        const interviewId = query.interviewId;
        const roomName = `interview-session-${interviewId}`;
        const sessionKey = `interview:session:${interviewId}`;

        await client.join(roomName);

        await this.redisClient.hset(sessionKey, {
            connectedAt: Date.now(),
            userId: client.data.userId || "unknown",
            lastActivity: Date.now(),
        });
        await this.redisClient.expire(sessionKey, 3600); // 1시간 TTL

        this.logger.log(client, "interview_session_joined", {
            roomName,
            interviewId,
        });

        // 1초 후 상태 동기화 또는 초기화 (Resumption 지원)
        setTimeout(() => {
            void this.synchronizeSession(client, interviewId, sessionKey);
        }, 1000);
    }

    /**
     * 세션의 종류(Standard vs Test)에 따라 동기화 로직을 분기하는 '전략' 진입점
     */
    private async synchronizeSession(client: any, interviewId: string, sessionKey: string) {
        try {
            if (interviewId.startsWith("debug-")) {
                this.syncDebugSession(client, interviewId);
            } else {
                await this.syncStandardSession(client, interviewId, sessionKey);
            }
        } catch (error) {
            this.logger.error(client, "initial_stage_sync_failed", {
                interviewId,
                error: String(error),
            });
        }
    }

    /**
     * [Standard] 실제 면접 세션: Core 서비스와 통신하여 상태 동기화 및 단계 전환 수행
     */
    private async syncStandardSession(client: any, interviewId: string, sessionKey: string) {
        // 현재 단계 확인
        const { stage: currentStage } = await this.stageService.getStage(interviewId);

        // Redis에 Stage 정보도 업데이트 (Cache Warm-up)
        await this.redisClient.hset(sessionKey, "stage", currentStage);

        if (currentStage === InterviewStage.WAITING) {
            // 최초 진입: WAITING -> GREETING 전환 (면접관 인사)
            await this.stageService.transitionStage(interviewId, InterviewStage.GREETING);
            await this.redisClient.hset(sessionKey, "stage", InterviewStage.GREETING);

            client.emit("interview:stage_changed", {
                interviewId,
                previousStage: InterviewStage.WAITING,
                currentStage: InterviewStage.GREETING,
            });
        } else {
            // 재접속(Resumption): 현재 상태 동기화
            this.logger.log(client, "interview_session_resumed", {
                interviewId,
                currentStage,
            });
            client.emit("interview:stage_changed", {
                interviewId,
                previousStage: currentStage,
                currentStage: currentStage,
            });

            // SELF_INTRO 재접속 시 타이머 동기화 — 프론트가 setTimeLeft(90)으로 초기화하므로
            // Redis의 실제 selfIntroStart 기준으로 남은 시간을 보정 전송
            if (currentStage === InterviewStage.SELF_INTRO) {
                const selfIntroStart = await this.redisClient.hget(sessionKey, "selfIntroStart");
                if (selfIntroStart) {
                    const elapsed = Math.floor((Date.now() - Number(selfIntroStart)) / 1000);
                    const timeLeft = Math.max(0, 90 - elapsed);
                    client.emit("interview:timer_sync", { timeLeft });
                }
            }
        }
    }

    /**
     * [Debug] 검증용 세션: 외부 서비스 연동 없이 최소한의 로그만 남김
     */
    private syncDebugSession(client: any, interviewId: string) {
        this.logger.log(client, "debug_interview_session_skip_sync", {
            interviewId,
        });
        // 디버그 세션은 항상 READY 상태임을 가정하거나 별도 처리가 필요 없으므로 즉시 종료
    }

    @OnEvent("socket.disconnected")
    handleSocketDisconnected(event: SocketDisconnectedEvent) {
        const { client } = event;

        this.logger.log(client, "interview_session_left", {
            socketId: client.id,
        });
    }
}
