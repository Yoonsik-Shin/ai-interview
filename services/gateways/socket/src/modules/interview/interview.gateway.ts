import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayInit,
} from "@nestjs/websockets";
import { OnModuleInit } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { AudioProcessorService } from "../stt/services/audio-processor.service";
import { AudioChunkDto } from "../stt/dto/audio-chunk.dto";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../infra/grpc/services/interview-grpc.service";
import { SocketLoggingService } from "../../core/logging/socket-logging.service";
import { SyncStageUseCase, SyncStageCommand } from "./usecases/sync-stage.usecase";
import { AudioProcessorFactory } from "./usecases/audio-processor.factory";
import { AudioProcessingCommand } from "./usecases/audio-processor.interface";
import { RedisClient } from "../../infra/redis/redis.clients";
import { DebugTraceGateway } from "../debug/debug-trace.gateway";

@WebSocketGateway({ cors: { origin: "*" } })
export class InterviewGateway implements OnModuleInit, OnGatewayInit {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly stageService: InterviewGrpcService,
        private readonly logger: SocketLoggingService,
        private readonly syncStageUseCase: SyncStageUseCase,
        private readonly audioProcessorService: AudioProcessorService,
        private readonly processorFactory: AudioProcessorFactory,
        private readonly redisClient: RedisClient,
        private readonly debugTraceGateway: DebugTraceGateway,
    ) {}

    onModuleInit() {
        // onModuleInit에서는 server가 null일 수 있음
    }

    afterInit(server: Server) {
        this.logger.log(null, "WebSocket server initialized in InterviewGateway");
        this.debugTraceGateway.setServer(server);
    }

    /**
     * 클라이언트가 특정 인터뷰의 트레이스 로그를 수신하기 위해 룸에 참여 요청
     */
    @SubscribeMessage("debug:join_trace")
    handleJoinTrace(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewId: string | number },
    ): void {
        const interviewId = payload.interviewId?.toString();
        if (!interviewId) return;

        // 운영 환경 배제
        if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod") {
            return;
        }

        const room = `debug:trace:${interviewId}`;
        void client.join(room);

        this.logger.log(client, "debug_trace_room_joined", { interviewId, room });

        // 참여 확인 이벤트 발송
        client.emit("debug:trace_joined", { interviewId, room });
    }

    /**
     * 클라이언트가 현재 단계 준비 완료(예: 안내 오디오 재생 완료)를 알림
     */
    @SubscribeMessage("interview:stage_ready")
    async handleStageReady(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: { interviewId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "stage_ready_received", payload);

        await this.syncStageUseCase.execute(
            new SyncStageCommand(
                client,
                payload.interviewId,
                payload.currentStage,
                undefined,
                "READY",
            ),
        );
    }

    @SubscribeMessage("debug:skip_stage")
    async handleDebugSkipStage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "debug_skip_stage", payload);
        let targetStage: InterviewStage | null = null;

        switch (payload.currentStage) {
            case InterviewStage.GREETING:
                targetStage = InterviewStage.CANDIDATE_GREETING;
                break;
            case InterviewStage.CANDIDATE_GREETING:
                targetStage = InterviewStage.INTERVIEWER_INTRO;
                break;
            case InterviewStage.INTERVIEWER_INTRO:
                targetStage = InterviewStage.SELF_INTRO_PROMPT;
                break;
            case InterviewStage.SELF_INTRO_PROMPT:
                targetStage = InterviewStage.SELF_INTRO;
                break;
            case InterviewStage.SELF_INTRO:
                targetStage = InterviewStage.IN_PROGRESS;
                break;
            default:
                this.logger.warn(client, "skip_stage_not_supported", payload);
                return;
        }

        const result = await this.syncStageUseCase.execute(
            new SyncStageCommand(
                client,
                payload.interviewId,
                payload.currentStage,
                targetStage,
                "DEBUG_SKIP",
            ),
        );

        client.emit("interview:stage_changed", {
            interviewId: payload.interviewId,
            previousStage: result.previousStage,
            currentStage: result.currentStage,
        });

        // 트레이스 발행 (개발 환경 전용)
        if (process.env.NODE_ENV === "development") {
            this.debugTraceGateway.broadcastTrace(payload.interviewId, "STAGE_CHANGE (DEBUG)", {
                previousStage: result.previousStage,
                currentStage: result.currentStage,
                reason: "DEBUG_SKIP",
            });
        }
    }

    /**
     * 사용자가 단계 스킵 요청 (예: 자기소개 건너뛰기)
     */
    @SubscribeMessage("interview:skip_stage")
    async handleSkipStage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "user_skip_stage", payload);

        const result = await this.syncStageUseCase.execute(
            new SyncStageCommand(
                client,
                payload.interviewId,
                payload.currentStage,
                undefined,
                "SKIP",
            ),
        );

        if (result.isIntervened) {
            client.emit("interview:intervene", {
                message: result.interventionMessage,
            });
        }

        if (result.currentStage !== payload.currentStage) {
            client.emit("interview:stage_changed", {
                interviewId: payload.interviewId,
                previousStage: result.previousStage,
                currentStage: result.currentStage,
            });

            // 트레이스 발행 (개발 환경 전용)
            if (process.env.NODE_ENV === "development") {
                this.debugTraceGateway.broadcastTrace(payload.interviewId, "STAGE_CHANGE", {
                    previousStage: result.previousStage,
                    currentStage: result.currentStage,
                    reason: "USER_SKIP",
                });
            }
        }
    }

    /**
     * [DEPRECATED] 사용자가 발화 시간 부족 등으로 인한 리트라이 요청
     * 리트라이 로직 폐기에 따라 더 이상 동작하지 않으며 로그만 남깁니다.
     */
    @SubscribeMessage("interview:request_retry")
    handleRequestRetry(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: {
            interviewId: string;
            currentStage: InterviewStage;
            durationSeconds?: number;
        },
    ): void {
        this.logger.log(client, "user_request_retry_ignored_logic_removed", payload);
    }

    /**
     * 오디오 청크 처리 - Factory를 통한 프로세서 라우팅
     */
    @SubscribeMessage("interview:audio_chunk")
    async handleAudioChunk(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AudioChunkDto,
    ): Promise<void> {
        try {
            if (!payload || !payload.interviewId) {
                this.logger.warn(client, "audio_chunk_missing_id", { payload });
                return;
            }

            const rtKey = `interview:rt:${payload.interviewId}`;
            const [canCandidateSpeak, cachedStage] = await this.redisClient.hmget(
                rtKey,
                "canCandidateSpeak",
                "stage",
            );
            if (canCandidateSpeak !== "true") {
                this.logger.warn(client, "audio_chunk_dropped_wrong_status", {
                    interviewId: payload.interviewId,
                    currentStatus: canCandidateSpeak,
                });
                return;
            }

            const stage =
                cachedStage && Object.values(InterviewStage).includes(cachedStage as InterviewStage)
                    ? (cachedStage as InterviewStage)
                    : (await this.stageService.getStage(payload.interviewId)).stage;
            const processor = this.processorFactory.getProcessor(stage);

            if (processor) {
                await processor.execute(new AudioProcessingCommand(client, payload));
            } else {
                this.logger.warn(client, "audio_chunk_no_processor_for_stage", {
                    interviewId: payload.interviewId,
                    stage,
                });
            }
        } catch (error) {
            this.logger.error(client, "audio_chunk_processing_failed", {
                interviewId: payload.interviewId,
                error: String(error),
            });
        }
    }

    @SubscribeMessage("interview:abort_stream")
    handleAbortStream(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewId: string },
    ): void {
        this.logger.log(client, "client_requested_abort", {
            interviewId: payload.interviewId,
        });
        this.audioProcessorService.abortProcessing(payload.interviewId);
    }

    /**
     * 사용자가 텍스트로 보낸 답변 처리 (접근성 기능)
     * 이 텍스트를 STT의 결과와 동일한 Redis Stream에 넣어서 Core가 처리하게 함
     */
    @SubscribeMessage("interview:text_input")
    async handleTextInput(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: {
            interviewId: string;
            text: string;
            userId?: string;
            retryCount?: number;
        },
    ): Promise<void> {
        try {
            if (!payload || !payload.interviewId || !payload.text) {
                return;
            }

            // 1. 현재 인터뷰가 답변을 듣고 있는 상태인지 확인 (중복 유입 방지)
            const rtKey = `interview:rt:${payload.interviewId}`;
            const canCandidateSpeak = await this.redisClient.hget(rtKey, "canCandidateSpeak");

            if (canCandidateSpeak !== "true") {
                this.logger.warn(client, "text_input_dropped_wrong_status", {
                    interviewId: payload.interviewId,
                    currentStatus: canCandidateSpeak,
                });
                return;
            }

            this.logger.log(client, "text_input_received", {
                interviewId: payload.interviewId,
                textLength: payload.text.length,
            });

            // 2. 텍스트를 Redis Stream(payload JSON 형식)으로 발행하여 Core가 처리하게 함
            const redisPayload = {
                interviewId: payload.interviewId,
                text: payload.text,
                userId: payload.userId || client.data.userId || "anonymous",
                isFinal: "true",
                isEmpty: "false",
                traceId: `text-${Date.now()}`,
                ts: Date.now(),
            };

            await this.redisClient.xadd(
                "interview:transcript:process",
                "*",
                "payload",
                JSON.stringify(redisPayload),
            );

            this.logger.log(client, "text_input_pushed", { interviewId: payload.interviewId });
        } catch (error) {
            this.logger.error(client, "text_input_failed", {
                interviewId: payload.interviewId,
                error: String(error),
            });
        }
    }

    @SubscribeMessage("interview:system_message")
    async handleSystemMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: {
            interviewId: string;
            content: string;
            stage?: InterviewStage;
            personaId?: string;
            turnCount?: number;
            sequenceNumber?: number;
            difficultyLevel?: number;
        },
    ): Promise<void> {
        try {
            if (!payload?.interviewId || !payload.content?.trim()) {
                return;
            }

            await this.stageService.saveInterviewMessage({
                interviewId: payload.interviewId,
                role: "AI",
                content: payload.content.trim(),
                stage: payload.stage,
                personaId: payload.personaId,
                turnCount: payload.turnCount ?? 0,
                sequenceNumber: payload.sequenceNumber ?? 0,
                difficultyLevel: payload.difficultyLevel,
            });

            this.logger.log(client, "system_message_saved", {
                interviewId: payload.interviewId,
                stage: payload.stage,
                turnCount: payload.turnCount,
            });
        } catch (error) {
            this.logger.error(client, "system_message_save_failed", {
                interviewId: payload?.interviewId,
                error: String(error),
            });
        }
    }
}
