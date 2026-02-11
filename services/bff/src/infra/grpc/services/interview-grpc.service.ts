import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import {
    InterviewServiceClient,
    CreateInterviewRequest,
    CreateInterviewResponse,
    ListInterviewsRequest,
    ListInterviewsResponse,
} from "@grpc-types/interview/v1/interview";
import {
    InterviewTypeProto,
    InterviewRoleProto,
    InterviewPersonalityProto,
    InterviewStatusProto,
} from "@grpc-types/common/v1/enums";
import {
    InterviewType,
    InterviewRole,
    InterviewPersonality,
} from "../../../modules/interview/enum/interview.enum";

@Injectable()
export class InterviewGrpcService implements OnModuleInit {
    private interviewService: InterviewServiceClient;

    constructor(
        @Inject("INTERVIEW_PACKAGE")
        private readonly client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.interviewService =
            this.client.getService<InterviewServiceClient>("InterviewService");
    }

    async createInterview(request: CreateInterviewRequest): Promise<CreateInterviewResponse> {
        return firstValueFrom(this.interviewService.createInterview(request));
    }

    async listInterviews(request: ListInterviewsRequest): Promise<ListInterviewsResponse> {
        return firstValueFrom(this.interviewService.listInterviews(request));
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

    fromProtoStatus(status: InterviewStatusProto): string {
        switch (status) {
            case InterviewStatusProto.READY:
                return "READY";
            case InterviewStatusProto.IN_PROGRESS:
                return "ING";
            case InterviewStatusProto.COMPLETED:
                return "COMPLETED";
            case InterviewStatusProto.CANCELLED:
                return "CANCELLED";
            default:
                return "UNKNOWN";
        }
    }
}
