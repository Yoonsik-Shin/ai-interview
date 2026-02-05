import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ProcessAudioService } from "../stt/services/process-audio.service";
import { AudioChunkDto } from "../stt/dto/audio-chunk.dto";
import { CoreInterviewGrpcService, InterviewStage } from "./services/core-interview-grpc.service";
import { RedisClient } from "../../infrastructure/redis/redis.clients";
import { SocketLoggingService } from "@/core/logging/socket-logging.service";

@WebSocketGateway({ cors: { origin: "*" } })
export class InterviewGateway {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly processAudioService: ProcessAudioService,
        private readonly stageService: CoreInterviewGrpcService,
        private readonly logger: SocketLoggingService,
        private readonly redisClient: RedisClient,
    ) {}

    /**
     * 클라이언트가 현재 단계 준비 완료(예: 안내 오디오 재생 완료)를 알림
     */
    @SubscribeMessage("interview:stage_ready")
    async handleStageReady(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: { interviewSessionId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "stage_ready_received", payload);

        if (payload.currentStage === InterviewStage.GREETING) {
            // GREETING -> CANDIDATE_GREETING 전환 (면접관 인사 완료 -> 지원자 인사 유도)
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.CANDIDATE_GREETING,
            );
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: payload.currentStage,
                currentStage: nextStage,
            });
        } else if (payload.currentStage === InterviewStage.INTERVIEWER_INTRO) {
            // INTERVIEWER_INTRO -> SELF_INTRO_PROMPT 전환 (면접관 자기소개 완료 -> 1분 자기소개 유도)
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.SELF_INTRO_PROMPT,
            );
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: payload.currentStage,
                currentStage: nextStage,
            });
        } else if (payload.currentStage === InterviewStage.SELF_INTRO_PROMPT) {
            // SELF_INTRO_PROMPT -> SELF_INTRO 전환 (자기소개 요청 완료)
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.SELF_INTRO,
            );

            // Redis에 시작 시간 기록 (Optimization) + Session TTL 갱신
            const sessionKey = `interview:session:${payload.interviewSessionId}`;
            await this.redisClient.hset(sessionKey, "selfIntroStart", Date.now());
            await this.redisClient.expire(sessionKey, 3600);

            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: payload.currentStage,
                currentStage: nextStage,
            });
        }
    }

    @SubscribeMessage("debug:skip_stage")
    async handleDebugSkipStage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewSessionId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "debug_skip_stage", payload);
        let nextStage: InterviewStage | null = null;

        switch (payload.currentStage) {
            case InterviewStage.GREETING:
                nextStage = InterviewStage.CANDIDATE_GREETING;
                break;
            case InterviewStage.CANDIDATE_GREETING:
                nextStage = InterviewStage.INTERVIEWER_INTRO;
                break;
            case InterviewStage.INTERVIEWER_INTRO:
                nextStage = InterviewStage.SELF_INTRO_PROMPT;
                break;
            case InterviewStage.SELF_INTRO_PROMPT:
                nextStage = InterviewStage.SELF_INTRO;
                break;
            case InterviewStage.SELF_INTRO:
                nextStage = InterviewStage.IN_PROGRESS;
                break;
            default:
                this.logger.warn(client, "skip_stage_not_supported", payload);
                return;
        }

        if (nextStage) {
            const newStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                nextStage,
            );
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: payload.currentStage,
                currentStage: newStage,
            });
        }
    }

    /**
     * 사용자가 단계 스킵 요청 (예: 자기소개 건너뛰기)
     */
    @SubscribeMessage("interview:skip_stage")
    async handleSkipStage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewSessionId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "user_skip_stage", payload);

        // 현재는 SELF_INTRO 단계만 스킵 허용
        if (payload.currentStage === InterviewStage.SELF_INTRO) {
            // SELF_INTRO → IN_PROGRESS 전환
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.IN_PROGRESS, // 바로 문답 시작
            );

            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: payload.currentStage,
                currentStage: nextStage,
            });

            // 개입 메시지 전송
            client.emit("interview:intervene", {
                message: "자기소개를 건너뛰고 바로 면접을 시작합니다.",
            });

            // Core에 "자기소개 생략" 메시지 전송하여 첫 질문 트리거
            // userId는 client에서 추출하거나 default 사용
            const userId = (client as any).userId || "unknown";
            await this.stageService.processUserAnswer(
                payload.interviewSessionId,
                "(자기소개 생략)",
                userId,
            );
        } else {
            this.logger.warn(client, "skip_stage_not_allowed", payload);
            // 허용되지 않은 단계면 무시하거나 에러 전송
        }
    }

    /**
     * 오디오 청크 처리 - Stage별로 다르게 처리
     */
    @SubscribeMessage("interview:audio_chunk")
    async handleAudioChunk(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AudioChunkDto,
    ): Promise<void> {
        try {
            const { stage } = await this.stageService.getStage(payload.interviewSessionId);

            this.logger.debug(client, "audio_chunk_received_with_stage", {
                interviewSessionId: payload.interviewSessionId,
                stage,
                isFinal: payload.isFinal,
            });

            // Stage별 처리
            switch (stage) {
                case InterviewStage.CANDIDATE_GREETING:
                    await this.processCandidateGreeting(client, payload);
                    break;

                case InterviewStage.SELF_INTRO:
                    await this.processSelfIntro(client, payload);
                    break;

                case InterviewStage.IN_PROGRESS:
                    await this.processNormalQA(client, payload);
                    break;

                case InterviewStage.LAST_ANSWER:
                    await this.processLastAnswer(client, payload);
                    break;

                case InterviewStage.CLOSING_GREETING:
                    await this.processClosingGreeting(client, payload);
                    break;

                case InterviewStage.WAITING:
                case InterviewStage.GREETING:
                case InterviewStage.INTERVIEWER_INTRO:
                case InterviewStage.SELF_INTRO_PROMPT:
                    // 이 단계에서는 오디오 처리하지 않음
                    this.logger.debug(client, "audio_chunk_ignored_in_stage", {
                        interviewSessionId: payload.interviewSessionId,
                        stage,
                    });
                    break;

                case InterviewStage.COMPLETED:
                    this.logger.warn(client, "audio_chunk_received_after_completion", {
                        interviewSessionId: payload.interviewSessionId,
                    });
                    break;

                default:
                    this.logger.warn(client, "unknown_interview_stage", {
                        interviewSessionId: payload.interviewSessionId,
                        stage,
                    });
                    // 기본적으로는 일반 처리
                    await this.processNormalQA(client, payload);
            }
        } catch (error) {
            this.logger.error(client, "audio_chunk_processing_failed", {
                interviewSessionId: payload.interviewSessionId,
                error: String(error),
            });
        }
    }

    @SubscribeMessage("interview:abort_stream")
    handleAbortStream(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewSessionId: string },
    ): void {
        this.logger.log(client, "client_requested_abort", {
            interviewSessionId: payload.interviewSessionId,
        });
        this.processAudioService.abortProcessing(payload.interviewSessionId);
    }

    /**
     * CANDIDATE_GREETING Stage: 면접자 인사 처리
     * - 짧게 인사만 받고 다음 단계로 전환
     */
    private async processCandidateGreeting(client: Socket, payload: AudioChunkDto): Promise<void> {
        // 일반 오디오 처리 (STT)
        await this.processAudioService.processAudio(client, payload);

        // isFinal인 경우 다음 stage로 전환 (면접관 자기소개)
        if (payload.isFinal) {
            this.logger.log(client, "candidate_greeting_completed", {
                interviewSessionId: payload.interviewSessionId,
            });

            // CANDIDATE_GREETING -> INTERVIEWER_INTRO 전환
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.INTERVIEWER_INTRO,
            );

            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: InterviewStage.CANDIDATE_GREETING,
                currentStage: nextStage,
            });
        }
    }

    /**
     * SELF_INTRO Stage: 1분 30초 자기소개 처리
     * - 90초까지 경청
     * - 90초 초과 시 면접관 개입
     */
    private async processSelfIntro(client: Socket, payload: AudioChunkDto): Promise<void> {
        // 일반 오디오 처리 (STT)
        await this.processAudioService.processAudio(client, payload);

        // 90초 경과 확인 (isFinal 시점에만)
        if (payload.isFinal) {
            // Redis Optimization: DB 대신 Redis에서 경과 시간 계산
            const selfIntroElapsedSeconds = await this.getSelfIntroElapsed(
                payload.interviewSessionId,
            );

            // 90초 초과 여부 확인 (강제 종료)
            if (selfIntroElapsedSeconds >= 90) {
                // ... (기존 90초 초과 로직)
                this.logger.log(client, "self_intro_time_exceeded", {
                    interviewSessionId: payload.interviewSessionId,
                    elapsedSeconds: selfIntroElapsedSeconds,
                });

                client.emit("interview:intervene", {
                    message:
                        "감사합니다. 충분히 들었습니다. 이제 본격적으로 면접을 시작하겠습니다.",
                });

                const nextStage = await this.stageService.transitionStage(
                    payload.interviewSessionId,
                    InterviewStage.IN_PROGRESS,
                );

                client.emit("interview:stage_changed", {
                    interviewSessionId: payload.interviewSessionId,
                    previousStage: InterviewStage.SELF_INTRO,
                    currentStage: nextStage,
                });
            } else if (selfIntroElapsedSeconds >= 30) {
                // ... (기존 정상 종료 로직)
                this.logger.log(client, "self_intro_completed_normally", {
                    interviewSessionId: payload.interviewSessionId,
                    elapsedSeconds: selfIntroElapsedSeconds,
                });

                const nextStage = await this.stageService.transitionStage(
                    payload.interviewSessionId,
                    InterviewStage.IN_PROGRESS,
                );

                client.emit("interview:stage_changed", {
                    interviewSessionId: payload.interviewSessionId,
                    previousStage: InterviewStage.SELF_INTRO,
                    currentStage: nextStage,
                });
            } else {
                // 30초 미만 고도화 로직
                const { selfIntroRetryCount } = await this.stageService.getStage(
                    payload.interviewSessionId,
                );

                if (selfIntroRetryCount < 2) {
                    // 재시도 부여
                    await this.stageService.incrementSelfIntroRetry(payload.interviewSessionId);

                    // Core DB 타이머 리셋 (transitionStage SELF_INTRO 호출 시 LocalDateTime.now()로 갱신됨)
                    await this.stageService.transitionStage(
                        payload.interviewSessionId,
                        InterviewStage.SELF_INTRO,
                    );

                    // Redis 타이머 리셋 (시작 시간을 현재로 갱신)
                    const sessionKey = `interview:session:${payload.interviewSessionId}`;
                    await this.redisClient.hset(sessionKey, "selfIntroStart", Date.now());

                    this.logger.log(client, "self_intro_retry_granted", {
                        interviewSessionId: payload.interviewSessionId,
                        retryCount: selfIntroRetryCount + 1,
                    });

                    // 프론트엔드 타이머 리셋 이벤트 (60초)
                    client.emit("interview:timer_sync", {
                        timeLeft: 60,
                    });

                    client.emit("interview:intervene", {
                        message:
                            "조금 더 구체적으로 자기소개를 해주시면 좋겠습니다. 지금까지 하신 말씀 외에 본인의 강점이나 프로젝트 경험을 더 들려주실 수 있을까요? 시간은 충분하니 편안하게 말씀해 주세요.",
                    });
                } else {
                    // 3회차에도 짧음 -> 강제 진행
                    this.logger.log(client, "self_intro_too_short_max_retries", {
                        interviewSessionId: payload.interviewSessionId,
                    });

                    client.emit("interview:intervene", {
                        message:
                            "네, 감사합니다. 말씀하신 내용을 바탕으로 이제 본격적인 면접을 시작하겠습니다.",
                    });

                    const nextStage = await this.stageService.transitionStage(
                        payload.interviewSessionId,
                        InterviewStage.IN_PROGRESS,
                    );

                    client.emit("interview:stage_changed", {
                        interviewSessionId: payload.interviewSessionId,
                        previousStage: InterviewStage.SELF_INTRO,
                        currentStage: nextStage,
                    });
                }
            }
        }
    }

    /**
     * 자기소개 경과 시간 계산 (Redis Cached)
     */
    /**
     * 자기소개 경과 시간 계산 (Redis Cached)
     * - Unified Session Key 사용 (interview:session:{id})
     */
    private async getSelfIntroElapsed(interviewSessionId: string): Promise<number> {
        const sessionKey = `interview:session:${interviewSessionId}`;
        const cachedStart = await this.redisClient.hget(sessionKey, "selfIntroStart");

        let startTime: number;
        if (cachedStart) {
            startTime = Number(cachedStart);
            // Cache Hit 시 TTL 연장 (Activity가 있으므로 유지)
            this.redisClient.expire(sessionKey, 3600).catch((err) => {
                this.logger.error(null, "redis_expire_error", { error: String(err) });
            });
            // Debug Log (Too noisy? maybe debug level)
            // this.logger.debug(null, "redis_time_cache_hit", { interviewSessionId, startTime });
        } else {
            // Cache Miss: Fallback to Core (gRPC) or current time
            const { selfIntroElapsedSeconds } =
                await this.stageService.getStage(interviewSessionId);

            this.logger.warn(null, "redis_time_cache_miss_fallback", {
                interviewSessionId,
                coreElapsed: selfIntroElapsedSeconds,
            });

            if (selfIntroElapsedSeconds > 0) {
                startTime = Date.now() - selfIntroElapsedSeconds * 1000;
            } else {
                startTime = Date.now();
            }
            // 캐시 저장 (1시간)
            await this.redisClient.hset(sessionKey, "selfIntroStart", startTime);
            await this.redisClient.expire(sessionKey, 3600);
        }
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // 5초 단위로 로그 출력
        if (elapsed % 5 === 0) {
            this.logger.debug(null, "self_intro_timer_check", { interviewSessionId, elapsed });
        }

        return elapsed;
    }

    /**
     * IN_PROGRESS Stage: 일반 Q&A 처리
     */
    private async processNormalQA(client: Socket, payload: AudioChunkDto): Promise<void> {
        // 일반 오디오 처리 (STT → LLM)
        await this.processAudioService.processAudio(client, payload);
    }

    /**
     * LAST_ANSWER Stage: 마지막 답변 처리
     * - 답변 완료 시 CLOSING_GREETING 단계로 전환
     */
    private async processLastAnswer(client: Socket, payload: AudioChunkDto): Promise<void> {
        await this.processAudioService.processAudio(client, payload);

        if (payload.isFinal) {
            this.logger.log(client, "last_answer_completed", {
                interviewSessionId: payload.interviewSessionId,
            });

            // LAST_ANSWER -> CLOSING_GREETING 전환
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.CLOSING_GREETING,
            );

            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: InterviewStage.LAST_ANSWER,
                currentStage: nextStage,
            });
        }
    }

    /**
     * CLOSING_GREETING Stage: 마무리 인사 처리
     * - 사용자의 끝인사("수고하셨습니다" 등)를 듣고 면접 완료 처리
     */
    private async processClosingGreeting(client: Socket, payload: AudioChunkDto): Promise<void> {
        await this.processAudioService.processAudio(client, payload);

        if (payload.isFinal) {
            this.logger.log(client, "closing_greeting_completed", {
                interviewSessionId: payload.interviewSessionId,
            });

            // CLOSING_GREETING -> COMPLETED 전환
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.COMPLETED,
            );

            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: InterviewStage.CLOSING_GREETING,
                currentStage: nextStage,
            });

            // 소켓 연결 종료 유도 등 마무리 작업
            // client.disconnect(); // 프론트엔드에서 처리하도록 유지
        }
    }
}
