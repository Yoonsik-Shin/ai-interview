import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
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
    COMPLETED_STAGE = 8,
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
}

interface TransitionStageResponse {
    currentStage: InterviewStageProto;
}

/**
 * Core gRPC Client for Interview Stage Management
 * Core 서비스의 Stage 관리 기능을 호출
 */
@Injectable()
export class CoreInterviewGrpcService implements OnModuleInit {
    private grpcService: any;

    constructor(
        @Inject("INTERVIEW_PACKAGE") private client: ClientGrpc,
        private readonly logger: SocketLoggingService,
    ) {}

    onModuleInit() {
        // gRPC 서비스 초기화 (반드시 OnModuleInit에서 수행)
        this.grpcService = this.client.getService("InterviewServiceGrpc");
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
            };
        } catch (error) {
            this.logger.error(null as any, "core_grpc_get_stage_failed", {
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

            this.logger.log(null as any, "core_grpc_stage_transitioned", {
                interviewSessionId,
                newStage,
                currentStage,
            });

            return currentStage;
        } catch (error) {
            this.logger.error(null as any, "core_grpc_transition_stage_failed", {
                interviewSessionId,
                newStage,
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
            case InterviewStage.COMPLETED:
                return InterviewStageProto.COMPLETED_STAGE;
            default:
                throw new Error(`Unknown domain stage: ${stage as any}`);
        }
    }
}
