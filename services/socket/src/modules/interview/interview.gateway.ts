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
import { SocketLoggingService } from "../../core/logging/socket-logging.service";

@WebSocketGateway({ cors: { origin: "*" } })
export class InterviewGateway {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly processAudioService: ProcessAudioService,
        private readonly stageService: CoreInterviewGrpcService,
        private readonly logger: SocketLoggingService,
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
            // GREETING -> CANDIDATE_GREETING 전환 (면접관 인사 완료)
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
            // INTERVIEWER_INTRO -> SELF_INTRO_PROMPT 전환
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
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: payload.currentStage,
                currentStage: nextStage,
            });
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
            const { selfIntroElapsedSeconds } = await this.stageService.getStage(
                payload.interviewSessionId,
            );

            // 90초 초과 여부 확인
            if (selfIntroElapsedSeconds >= 90) {
                this.logger.log(client, "self_intro_time_exceeded", {
                    interviewSessionId: payload.interviewSessionId,
                    elapsedSeconds: selfIntroElapsedSeconds,
                });

                // 면접관 개입 메시지 전송
                client.emit("interview:intervene", {
                    message:
                        "감사합니다. 충분히 들었습니다. 이제 본격적으로 면접을 시작하겠습니다.",
                });

                // SELF_INTRO → IN_PROGRESS 전환
                await this.stageService.transitionStage(
                    payload.interviewSessionId,
                    InterviewStage.IN_PROGRESS,
                );

                // TODO: LLM에 개입 메시지 전송하여 "자기소개 충분히 들었으니 다음 질문 시작" 안내
            }
        }
    }

    /**
     * IN_PROGRESS Stage: 일반 Q&A 처리
     */
    private async processNormalQA(client: Socket, payload: AudioChunkDto): Promise<void> {
        // 일반 오디오 처리 (STT → LLM)
        await this.processAudioService.processAudio(client, payload);
    }
}
