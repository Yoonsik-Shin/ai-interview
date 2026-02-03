import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import type { SocketConnectedEvent, SocketDisconnectedEvent } from "src/modules/modules.interface";
import { ConnectionEventType } from "../../modules.enum";
import { CoreInterviewGrpcService, InterviewStage } from "../services/core-interview-grpc.service";
import { RedisClient } from "../../../infrastructure/redis/redis.clients";

@Injectable()
export class InterviewConnectionListener {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly stageService: CoreInterviewGrpcService,
        private readonly redisClient: RedisClient,
    ) {}

    @OnEvent("socket.connected")
    async handleInterviewStart(event: SocketConnectedEvent) {
        const { client } = event;
        const { query } = client.data;

        // "interview" 타입으로 접속했는데 ID를 빠뜨린 경우 명시적으로 에러 처리
        if (query.type === ConnectionEventType.Interview && !query.interviewSessionId) {
            this.logger.log(client, "interview_session_id_missing");
            client.emit("connection:error", {
                code: "MISSING_SESSION_ID",
                message: "Missing interviewSessionId for interview connection",
            });
            client.disconnect();
            return;
        }

        if (Array.isArray(query.interviewSessionId)) {
            this.logger.log(client, "interview_session_id_duplicated", {
                interviewSessionId: query.interviewSessionId,
            });
            client.emit("connection:error", {
                code: "DUPLICATE_SESSION_ID",
                message: "Duplicate interviewSessionId parameter",
            });
            client.disconnect();
            return;
        }

        const interviewSessionId = query.interviewSessionId as string;
        const roomName = `interview-session-${interviewSessionId}`;
        const sessionKey = `interview:session:${interviewSessionId}`;

        // Room에 join (Redis Adapter를 통해 다른 Pod에서도 메시지 수신 가능)
        await client.join(roomName);

        // Redis Session Init / Refresh
        await this.redisClient.hset(sessionKey, {
            connectedAt: Date.now(),
            userId: client.data.userId || "unknown",
            lastActivity: Date.now(),
        });
        await this.redisClient.expire(sessionKey, 3600); // 1시간 TTL

        this.logger.log(client, "interview_session_joined", {
            roomName,
            interviewSessionId,
        });

        // 1초 후 상태 동기화 또는 초기화 (Resumption 지원)
        setTimeout(() => {
            void (async () => {
                try {
                    // 현재 단계 확인
                    const { stage: currentStage } =
                        await this.stageService.getStage(interviewSessionId);

                    // Redis에 Stage 정보도 업데이트 (Cache Warm-up)
                    await this.redisClient.hset(sessionKey, "stage", currentStage);

                    if (currentStage === InterviewStage.WAITING) {
                        // 최초 진입: WAITING -> GREETING 전환 (면접관 인사)
                        await this.stageService.transitionStage(
                            interviewSessionId,
                            InterviewStage.GREETING,
                        );

                        await this.redisClient.hset(sessionKey, "stage", InterviewStage.GREETING);

                        // 클라이언트에 상태 변경 알림
                        client.emit("interview:stage_changed", {
                            interviewSessionId,
                            previousStage: InterviewStage.WAITING,
                            currentStage: InterviewStage.GREETING,
                        });
                    } else {
                        // 재접속(Resumption): 현재 상태 동기화
                        this.logger.log(client, "interview_session_resumed", {
                            interviewSessionId,
                            currentStage,
                        });
                        client.emit("interview:stage_changed", {
                            interviewSessionId,
                            previousStage: currentStage,
                            currentStage: currentStage,
                        });
                    }
                } catch (error) {
                    this.logger.error(client, "initial_stage_sync_failed", {
                        interviewSessionId,
                        error: String(error),
                    });
                }
            })();
        }, 1000);
    }

    @OnEvent("socket.disconnected")
    handleSocketDisconnected(event: SocketDisconnectedEvent) {
        const { client } = event;

        // Core 서비스가 DB를 관리하므로 Socket 연결 해제 시 특별한 정리 작업 불필요
        // (필요 시 세션 상태를 CANCELLED 등으로 변경할 수 있으나, 여기서는 Stage만 관리)

        this.logger.log(client, "interview_session_left", {
            socketId: client.id,
        });
    }
}
