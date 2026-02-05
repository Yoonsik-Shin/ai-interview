import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import {
    CreateInterviewDto,
    InterviewType,
    InterviewRole,
    InterviewPersonality,
} from "../dto/create-interview.dto";
import { lastValueFrom } from "rxjs";
import type { ClientGrpc } from "@nestjs/microservices";
import {
    CreateInterviewRequest,
    InterviewServiceGrpcClient,
    InterviewTypeProto,
    InterviewRoleProto,
    InterviewPersonalityProto,
} from "../../../generated/interview"; // Adjusted path from usecases/ -> generated/

@Injectable()
export class startInterviewUseCase implements OnModuleInit {
    private grpcService: InterviewServiceGrpcClient;

    constructor(@Inject("INTERVIEW_PACKAGE") private readonly client: ClientGrpc) {}

    onModuleInit() {
        this.grpcService =
            this.client.getService<InterviewServiceGrpcClient>("InterviewServiceGrpc");
    }

    async execute(userId: string, dto: CreateInterviewDto) {
        console.log(`BFF: gRPC 요청 전송 시작 (userId: ${userId})`);

        // Map DTO Enums (String) to Proto Enums (Number)
        const typeProto = this.mapType(dto.type);
        const rolesProto = dto.interviewerRoles.map((r) => this.mapRole(r));
        const personalityProto = this.mapPersonality(dto.personality);

        const payload: CreateInterviewRequest = {
            userId,
            ...(dto.resumeId && { resumeId: dto.resumeId.toString() }),
            domain: dto.domain,
            type: typeProto,
            // persona field removed
            interviewerRoles: rolesProto,
            personality: personalityProto,
            interviewerCount: dto.interviewerRoles.length, // Derived from roles
            targetDurationMinutes: dto.targetDurationMinutes,
            selfIntroduction: dto.selfIntroduction,
        };

        try {
            const response = await lastValueFrom(this.grpcService.createInterview(payload));
            console.log("BFF: gRPC 응답 수신:", JSON.stringify(response));

            return {
                interviewId: response.interviewId,
                status: response.status,
            };
        } catch (error) {
            console.error("BFF: gRPC 호출 중 에러 발생", error);
            throw error;
        }
    }

    private mapType(type: InterviewType): InterviewTypeProto {
        switch (type) {
            case InterviewType.REAL:
                return InterviewTypeProto.REAL;
            case InterviewType.PRACTICE:
                return InterviewTypeProto.PRACTICE;
            default:
                return InterviewTypeProto.INTERVIEW_TYPE_UNSPECIFIED;
        }
    }

    private mapRole(role: InterviewRole): InterviewRoleProto {
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

    private mapPersonality(p: InterviewPersonality): InterviewPersonalityProto {
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
}
