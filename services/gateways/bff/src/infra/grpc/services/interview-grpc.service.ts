import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import {
    InterviewServiceClient,
    CreateInterviewRequest,
    CreateInterviewResponse,
    ListInterviewsRequest,
    ListInterviewsResponse,
    GetInterviewRequest,
    GetInterviewResponse,
} from "@grpc-types/interview/v1/interview";
import {
    InterviewTypeProto,
    InterviewRoleProto,
    InterviewPersonalityProto,
    InterviewStatusProto,
    InterviewStageProto,
} from "@grpc-types/common/v1/enums";
import {
    InterviewType,
    InterviewRole,
    InterviewPersonality,
    InterviewStage,
} from "../../../modules/interview/enum/interview.enum";

@Injectable()
export class InterviewGrpcService implements OnModuleInit {
    private interviewService: InterviewServiceClient;

    constructor(
        @Inject("INTERVIEW_PACKAGE")
        private readonly client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.interviewService = this.client.getService<InterviewServiceClient>("InterviewService");
    }

    async createInterview(request: CreateInterviewRequest): Promise<CreateInterviewResponse> {
        return firstValueFrom(this.interviewService.createInterview(request));
    }

    async listInterviews(request: ListInterviewsRequest): Promise<ListInterviewsResponse> {
        return firstValueFrom(this.interviewService.listInterviews(request));
    }

    async getInterview(interviewId: string): Promise<GetInterviewResponse> {
        return firstValueFrom(this.interviewService.getInterview({ interviewId }));
    }

    async getHistory(interviewId: string): Promise<any> {
        // Note: getInterviewHistory is not in the generated types yet
        // Will be available after proto recompilation
        const service = this.interviewService as any;
        return firstValueFrom(service.getInterviewHistory({ interviewId }));
    }

    async completeInterview(interviewId: string): Promise<any> {
        const service = this.interviewService as any;
        return firstValueFrom(service.completeInterview({ interviewId }));
    }

    async cancelInterview(interviewId: string, reason?: string): Promise<any> {
        const service = this.interviewService as any;
        return firstValueFrom(service.cancelInterview({ interviewId, reason }));
    }

    async pauseInterview(interviewId: string): Promise<any> {
        const service = this.interviewService as any;
        return firstValueFrom(service.pauseInterview({ interviewId }));
    }

    async resumeInterview(interviewId: string): Promise<any> {
        const service = this.interviewService as any;
        return firstValueFrom(service.resumeInterview({ interviewId }));
    }

    async forceStage(interviewId: string, targetStage: string): Promise<any> {
        const service = this.interviewService as any;
        return firstValueFrom(service.forceStage({ interviewId, targetStage }));
    }

    // --- Mappings ---

    toProtoType(type: InterviewType): InterviewTypeProto {
        switch (type) {
            case InterviewType.REAL:
                return InterviewTypeProto.REAL;
            case InterviewType.PRACTICE:
                return InterviewTypeProto.PRACTICE;
            default:
                return InterviewTypeProto.INTERVIEW_TYPE_UNSPECIFIED;
        }
    }

    fromProtoType(proto: InterviewTypeProto): InterviewType {
        switch (proto) {
            case InterviewTypeProto.REAL:
                return InterviewType.REAL;
            case InterviewTypeProto.PRACTICE:
                return InterviewType.PRACTICE;
            default:
                return InterviewType.PRACTICE;
        }
    }

    toProtoRole(role: InterviewRole): InterviewRoleProto {
        switch (role) {
            case InterviewRole.TECH:
                return InterviewRoleProto.TECH;
            case InterviewRole.HR:
                return InterviewRoleProto.HR;
            case InterviewRole.LEADER:
                return InterviewRoleProto.LEADER;
            default:
                return InterviewRoleProto.INTERVIEW_ROLE_UNSPECIFIED;
        }
    }

    fromProtoRole(role: InterviewRoleProto): InterviewRole {
        switch (role) {
            case InterviewRoleProto.TECH:
                return InterviewRole.TECH;
            case InterviewRoleProto.HR:
                return InterviewRole.HR;
            case InterviewRoleProto.LEADER:
                return InterviewRole.LEADER;
            default:
                return InterviewRole.TECH;
        }
    }

    toProtoPersonality(p: InterviewPersonality): InterviewPersonalityProto {
        switch (p) {
            case InterviewPersonality.PRESSURE:
                return InterviewPersonalityProto.PRESSURE;
            case InterviewPersonality.COMFORTABLE:
                return InterviewPersonalityProto.COMFORTABLE;
            case InterviewPersonality.RANDOM:
                return InterviewPersonalityProto.RANDOM;
            default:
                return InterviewPersonalityProto.INTERVIEW_PERSONALITY_UNSPECIFIED;
        }
    }

    fromProtoPersonality(p: InterviewPersonalityProto): InterviewPersonality {
        switch (p) {
            case InterviewPersonalityProto.PRESSURE:
                return InterviewPersonality.PRESSURE;
            case InterviewPersonalityProto.COMFORTABLE:
                return InterviewPersonality.COMFORTABLE;
            case InterviewPersonalityProto.RANDOM:
                return InterviewPersonality.RANDOM;
            default:
                return InterviewPersonality.RANDOM;
        }
    }

    fromProtoStatus(status: InterviewStatusProto): string {
        switch (status) {
            case InterviewStatusProto.READY:
                return "READY";
            case InterviewStatusProto.IN_PROGRESS:
                return "IN_PROGRESS";
            case InterviewStatusProto.COMPLETED:
                return "COMPLETED";
            case InterviewStatusProto.CANCELLED:
                return "CANCELLED";
            case InterviewStatusProto.PAUSED:
                return "PAUSED";
            default:
                return "UNKNOWN";
        }
    }

    toProtoStatus(status: string): InterviewStatusProto {
        switch (status) {
            case "READY":
                return InterviewStatusProto.READY;
            case "IN_PROGRESS":
            case "ING":
                return InterviewStatusProto.IN_PROGRESS;
            case "COMPLETED":
                return InterviewStatusProto.COMPLETED;
            case "CANCELLED":
                return InterviewStatusProto.CANCELLED;
            case "PAUSED":
                return InterviewStatusProto.PAUSED;
            default:
                return InterviewStatusProto.INTERVIEW_STATUS_UNSPECIFIED;
        }
    }

    fromProtoStage(stage: InterviewStageProto): string {
        switch (stage) {
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
                return InterviewStage.WAITING;
        }
    }
}
