import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, Observable } from "rxjs";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";

/**
 * Interview Stage Enum (Core와 동기화)
 */
export enum InterviewStage {
    WAITING = "WAITING",
    GREETING = "GREETING",
    CANDIDATE_GREETING = "CANDIDATE_GREETING",
    INTERVIEWER_INTRO = "INTERVIEWER_INTRO",
    SELF_INTRO_PROMPT = "SELF_INTRO_PROMPT",
    SELF_INTRO = "SELF_INTRO",
    IN_PROGRESS = "IN_PROGRESS",
    LAST_QUESTION_PROMPT = "LAST_QUESTION_PROMPT",
    LAST_ANSWER = "LAST_ANSWER",
    CLOSING_GREETING = "CLOSING_GREETING",
    COMPLETED = "COMPLETED",
}

/**
 * Proto Enum 매핑
 */
enum InterviewStageProto {
    INTERVIEW_STAGE_UNSPECIFIED = 0,
    WAITING = 1,
    GREETING = 2,
    CANDIDATE_GREETING = 3,
    INTERVIEWER_INTRO = 4,
    SELF_INTRO_PROMPT = 5,
    SELF_INTRO = 6,
    IN_PROGRESS_STAGE = 7,
    LAST_QUESTION_PROMPT = 8,
    LAST_ANSWER = 9,
    COMPLETED_STAGE = 10,
    CLOSING_GREETING = 11,
}

/**
 * gRPC 응답 타입
 */
interface GetInterviewStageResponse {
    stage: InterviewStageProto;
    selfIntroElapsedSeconds: number;
    persona?: string;
    interviewerCount?: number;
    domain?: string;
    selfIntroRetryCount: number;
    interviewerRoles?: number[];
    personality?: number;
}

interface IncrementSelfIntroRetryResponse {
    newRetryCount: number;
}

interface TransitionStageResponse {
    currentStage: InterviewStageProto;
}

interface InterviewServiceGrpc {
    getInterviewStage(request: {
        interviewSessionId: string;
    }): Observable<GetInterviewStageResponse>;
    transitionStage(request: {
        interviewSessionId: string;
        newStage: InterviewStageProto;
    }): Observable<TransitionStageResponse>;
    processUserAnswer(request: {
        interviewSessionId: string;
        userText: string;
        userId: string;
        timestamp: string;
    }): Observable<void>;
    incrementSelfIntroRetry(request: {
        interviewSessionId: string;
    }): Observable<IncrementSelfIntroRetryResponse>;
}

@Injectable()
export class InterviewGrpcService implements OnModuleInit {
    private grpcService: InterviewServiceGrpc;

    constructor(
        @Inject("INTERVIEW_PACKAGE") private client: ClientGrpc,
        private readonly logger: SocketLoggingService,
    ) {}

    onModuleInit() {
        // gRPC 서비스 초기화 (반드시 OnModuleInit에서 수행)
        this.grpcService = this.client.getService<InterviewServiceGrpc>("InterviewService");
    }

    /**
     * 현재 Interview Stage 조회
     */
    async getStage(interviewSessionId: string | number): Promise<{
        stage: InterviewStage;
        selfIntroElapsedSeconds: number;
        persona?: string;
        interviewerCount?: number;
        domain?: string;
        selfIntroRetryCount: number;
        interviewerRoles?: number[];
        personality?: number;
    }> {
        try {
            const request = {
                interviewSessionId: interviewSessionId.toString(),
            };

            const response: GetInterviewStageResponse = await firstValueFrom(
                this.grpcService.getInterviewStage(request),
            );

            return {
                stage: this.mapStageFromProto(response.stage),
                selfIntroElapsedSeconds: Number(response.selfIntroElapsedSeconds),
                persona: response.persona,
                interviewerCount: response.interviewerCount,
                domain: response.domain,
                selfIntroRetryCount: response.selfIntroRetryCount,
                interviewerRoles: response.interviewerRoles,
                personality: response.personality,
            };
        } catch (error) {
            this.logger.error(null, "core_grpc_get_stage_failed", {
                interviewSessionId,
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * Interview Stage 전환
     */
    async transitionStage(
        interviewSessionId: string | number,
        newStage: InterviewStage,
    ): Promise<InterviewStage> {
        try {
            const request = {
                interviewSessionId: interviewSessionId.toString(),
                newStage: this.mapStageToProto(newStage),
            };

            const response: TransitionStageResponse = await firstValueFrom(
                this.grpcService.transitionStage(request),
            );

            const currentStage = this.mapStageFromProto(response.currentStage);

            // The user requested to remove debug logs. This log is being removed.
            // this.logger.log(null, "core_grpc_stage_transitioned", {
            //     interviewSessionId,
            //     newStage,
            //     currentStage,
            // });

            return currentStage;
        } catch (error) {
            this.logger.error(null, "core_grpc_transition_stage_failed", {
                interviewSessionId,
                newStage,
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * 사용자 답변 처리 요청 (Skip 등에서 텍스트 직접 전송 시 사용)
     */
    async processUserAnswer(
        interviewSessionId: string | number,
        userText: string,
        userId: string = "user", // Default or passed
    ): Promise<void> {
        try {
            const request = {
                interviewSessionId: interviewSessionId.toString(),
                userText,
                userId,
                timestamp: new Date().toISOString(),
            };

            await firstValueFrom(this.grpcService.processUserAnswer(request));

            this.logger.log(null, "core_grpc_process_user_answer_sent", {
                interviewSessionId,
                userText,
            });
        } catch (error) {
            this.logger.error(null, "core_grpc_process_user_answer_failed", {
                interviewSessionId,
                error: String(error),
            });
            throw error;
        }
    }

    async incrementSelfIntroRetry(interviewSessionId: string | number): Promise<number> {
        try {
            const request = {
                interviewSessionId: interviewSessionId.toString(),
            };

            const response: IncrementSelfIntroRetryResponse = await firstValueFrom(
                this.grpcService.incrementSelfIntroRetry(request),
            );

            this.logger.log(null, "core_grpc_increment_retry_sent", {
                interviewSessionId,
                newRetryCount: response.newRetryCount,
            });

            return response.newRetryCount;
        } catch (error) {
            this.logger.error(null, "core_grpc_increment_retry_failed", {
                interviewSessionId,
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * Proto → Domain Stage 변환
     */
    private mapStageFromProto(proto: InterviewStageProto): InterviewStage {
        switch (proto) {
            case InterviewStageProto.WAITING:
                return InterviewStage.WAITING;
            case InterviewStageProto.GREETING:
                return InterviewStage.GREETING;
            case InterviewStageProto.CANDIDATE_GREETING:
                return InterviewStage.CANDIDATE_GREETING;
            case InterviewStageProto.INTERVIEWER_INTRO:
                return InterviewStage.INTERVIEWER_INTRO;
            case InterviewStageProto.SELF_INTRO_PROMPT:
                return InterviewStage.SELF_INTRO_PROMPT;
            case InterviewStageProto.SELF_INTRO:
                return InterviewStage.SELF_INTRO;
            case InterviewStageProto.IN_PROGRESS_STAGE:
                return InterviewStage.IN_PROGRESS;
            case InterviewStageProto.LAST_QUESTION_PROMPT:
                return InterviewStage.LAST_QUESTION_PROMPT;
            case InterviewStageProto.LAST_ANSWER:
                return InterviewStage.LAST_ANSWER;
            case InterviewStageProto.CLOSING_GREETING:
                return InterviewStage.CLOSING_GREETING;
            case InterviewStageProto.COMPLETED_STAGE:
                return InterviewStage.COMPLETED;
            default:
                throw new Error(`Unknown proto stage: ${proto}`);
        }
    }

    /**
     * Domain → Proto Stage 변환
     */
    private mapStageToProto(stage: InterviewStage): InterviewStageProto {
        switch (stage) {
            case InterviewStage.WAITING:
                return InterviewStageProto.WAITING;
            case InterviewStage.GREETING:
                return InterviewStageProto.GREETING;
            case InterviewStage.CANDIDATE_GREETING:
                return InterviewStageProto.CANDIDATE_GREETING;
            case InterviewStage.INTERVIEWER_INTRO:
                return InterviewStageProto.INTERVIEWER_INTRO;
            case InterviewStage.SELF_INTRO_PROMPT:
                return InterviewStageProto.SELF_INTRO_PROMPT;
            case InterviewStage.SELF_INTRO:
                return InterviewStageProto.SELF_INTRO;
            case InterviewStage.IN_PROGRESS:
                return InterviewStageProto.IN_PROGRESS_STAGE;
            case InterviewStage.LAST_QUESTION_PROMPT:
                return InterviewStageProto.LAST_QUESTION_PROMPT;
            case InterviewStage.LAST_ANSWER:
                return InterviewStageProto.LAST_ANSWER;
            case InterviewStage.CLOSING_GREETING:
                return InterviewStageProto.CLOSING_GREETING;
            case InterviewStage.COMPLETED:
                return InterviewStageProto.COMPLETED_STAGE;
            default:
                throw new Error(`Unknown domain stage: ${stage as string}`);
        }
    }
}
