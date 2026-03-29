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

export enum InterviewTurnStatus {
    READY = "READY",
    LISTENING = "LISTENING",
    THINKING = "THINKING",
    SPEAKING = "SPEAKING",
    PAUSED = "PAUSED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
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

enum InterviewTurnStatusProto {
    INTERVIEW_TURN_STATUS_UNSPECIFIED = 0,
    TURN_READY = 1,
    LISTENING = 2,
    THINKING = 3,
    SPEAKING = 4,
    TURN_PAUSED = 5,
    TURN_COMPLETED = 6,
    TURN_CANCELLED = 7,
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
    participatingPersonas?: string[];
    personality?: number;
    turnStatus?: InterviewTurnStatusProto;
    turnCount?: number;
    activePersonaId?: string;
    canCandidateSpeak?: boolean;
}

interface RetrySelfIntroResponse {
    success: boolean;
    newRetryCount: number;
    isMaxRetryExceeded: boolean;
}

interface TransitionStageResponse {
    currentStage: InterviewStageProto;
}

interface InterviewServiceGrpc {
    getInterviewStage(request: { interviewId: string }): Observable<GetInterviewStageResponse>;
    transitionStage(request: {
        interviewId: string;
        newStage: InterviewStageProto;
    }): Observable<TransitionStageResponse>;
    processUserAnswer(request: {
        interviewId: string;
        userText: string;
        userId: string;
        timestamp: string;
    }): Observable<void>;
    saveInterviewMessage(request: {
        interviewId: string;
        role: string;
        content: string;
        stage?: string;
        personaId?: string;
        turnCount: number;
        sequenceNumber: number;
        difficultyLevel?: number;
    }): Observable<{ success: boolean }>;
    retrySelfIntro(request: {
        interviewId: string;
        durationSeconds: number;
    }): Observable<RetrySelfIntroResponse>;
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
    async getStage(interviewId: string | number): Promise<{
        stage: InterviewStage;
        selfIntroElapsedSeconds: number;
        persona?: string;
        interviewerCount?: number;
        domain?: string;
        selfIntroRetryCount: number;
        participatingPersonas?: string[];
        personality?: number;
        turnStatus: InterviewTurnStatus;
        turnCount: number;
        activePersonaId?: string;
        canCandidateSpeak: boolean;
    }> {
        try {
            const request = {
                interviewId: interviewId.toString(),
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
                participatingPersonas: response.participatingPersonas,
                personality: response.personality,
                turnStatus: this.mapTurnStatusFromProto(response.turnStatus),
                turnCount: Number(response.turnCount || 0),
                activePersonaId: response.activePersonaId,
                canCandidateSpeak: Boolean(response.canCandidateSpeak),
            };
        } catch (error) {
            this.logger.error(null, "core_grpc_get_stage_failed", {
                interviewId,
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * Interview Stage 전환
     */
    async transitionStage(
        interviewId: string | number,
        newStage: InterviewStage,
    ): Promise<InterviewStage> {
        try {
            const request = {
                interviewId: interviewId.toString(),
                newStage: this.mapStageToProto(newStage),
            };

            const response: TransitionStageResponse = await firstValueFrom(
                this.grpcService.transitionStage(request),
            );

            const currentStage = this.mapStageFromProto(response.currentStage);

            // The user requested to remove debug logs. This log is being removed.
            // this.logger.log(null, "core_grpc_stage_transitioned", {
            //     interviewId,
            //     newStage,
            //     currentStage,
            // });

            return currentStage;
        } catch (error) {
            this.logger.error(null, "core_grpc_transition_stage_failed", {
                interviewId,
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
        interviewId: string | number,
        userText: string,
        userId: string = "user", // Default or passed
    ): Promise<void> {
        try {
            const request = {
                interviewId: interviewId.toString(),
                userText,
                userId,
                timestamp: new Date().toISOString(),
            };

            await firstValueFrom(this.grpcService.processUserAnswer(request));

            this.logger.log(null, "core_grpc_process_user_answer_sent", {
                interviewId,
                userText,
            });
        } catch (error) {
            this.logger.error(null, "core_grpc_process_user_answer_failed", {
                interviewId,
                error: String(error),
            });
            throw error;
        }
    }

    async retrySelfIntro(
        interviewId: string | number,
        durationSeconds: number,
    ): Promise<RetrySelfIntroResponse> {
        try {
            const request = {
                interviewId: interviewId.toString(),
                durationSeconds,
            };

            const response: RetrySelfIntroResponse = await firstValueFrom(
                this.grpcService.retrySelfIntro(request),
            );

            this.logger.log(null, "core_grpc_retry_self_intro_sent", {
                interviewId,
                newRetryCount: response.newRetryCount,
                isMaxRetryExceeded: response.isMaxRetryExceeded,
            });

            return response;
        } catch (error) {
            this.logger.error(null, "core_grpc_retry_self_intro_failed", {
                interviewId,
                error: String(error),
            });
            throw error;
        }
    }

    async saveInterviewMessage(payload: {
        interviewId: string | number;
        role: "SYSTEM" | "AI" | "USER";
        content: string;
        stage?: string;
        personaId?: string;
        turnCount?: number;
        sequenceNumber?: number;
        difficultyLevel?: number;
    }): Promise<void> {
        try {
            await firstValueFrom(
                this.grpcService.saveInterviewMessage({
                    interviewId: payload.interviewId.toString(),
                    role: payload.role,
                    content: payload.content,
                    stage: payload.stage,
                    personaId: payload.personaId,
                    turnCount: payload.turnCount ?? 0,
                    sequenceNumber: payload.sequenceNumber ?? 0,
                    difficultyLevel: payload.difficultyLevel,
                }),
            );
        } catch (error) {
            this.logger.error(null, "core_grpc_save_interview_message_failed", {
                interviewId: payload.interviewId,
                role: payload.role,
                stage: payload.stage,
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

    private mapTurnStatusFromProto(
        proto?: InterviewTurnStatusProto,
    ): InterviewTurnStatus {
        switch (proto) {
            case InterviewTurnStatusProto.LISTENING:
                return InterviewTurnStatus.LISTENING;
            case InterviewTurnStatusProto.THINKING:
                return InterviewTurnStatus.THINKING;
            case InterviewTurnStatusProto.SPEAKING:
                return InterviewTurnStatus.SPEAKING;
            case InterviewTurnStatusProto.TURN_PAUSED:
                return InterviewTurnStatus.PAUSED;
            case InterviewTurnStatusProto.TURN_COMPLETED:
                return InterviewTurnStatus.COMPLETED;
            case InterviewTurnStatusProto.TURN_CANCELLED:
                return InterviewTurnStatus.CANCELLED;
            case InterviewTurnStatusProto.TURN_READY:
            case InterviewTurnStatusProto.INTERVIEW_TURN_STATUS_UNSPECIFIED:
            default:
                return InterviewTurnStatus.READY;
        }
    }
}
