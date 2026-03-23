import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";
import {
    InterviewType,
    InterviewRole,
    InterviewPersonality,
    InterviewStatus,
    InterviewStage,
} from "../enum/interview.enum";

export class GetInterviewCommand {
    constructor(public readonly interviewId: string) {}
}

export class GetInterviewResult {
    constructor(
        public readonly interviewId: string,
        public readonly status: string,
        public readonly currentStage: string,
        public readonly type: InterviewType,
        public readonly domain: string,
        public readonly targetDurationMinutes: number,
        public readonly selfIntroduction: string,
        public readonly interviewerRoles: InterviewRole[],
        public readonly personality: InterviewPersonality,
        public readonly interviewerCount: number,
        public readonly createdAt: string,
        public readonly resumedAt: string,
    ) {}
}

@Injectable()
export class GetInterviewUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: GetInterviewCommand): Promise<GetInterviewResult> {
        const response = await this.interviewGrpcService.getInterview(command.interviewId);

        return new GetInterviewResult(
            response.interviewId,
            this.interviewGrpcService.fromProtoStatus(response.status),
            // We might need to map stage as well if it's not a string in proto response or we want specific enum
            // Assuming proto returns an enum that needs mapping, but interview-grpc.service doesn't expose stage mapper yet maybe?
            // Let's check interview-grpc.service.ts if it has toProtoStage or fromProtoStage.
            // Wait, response.currentStage is likely an enum/number from proto.
            // I should default to string representation or map it.
            // Let's assume for now we use the string value or add a mapper if needed.
            // Actually, let's just cast it to string or use a helper if available.
            // For now, I'll use a placeholder and fix it after checking the service.
            // Wait, response.currentStage is of type InterviewStageProto (enum).
            // I need a mapper for Stage.
            this.interviewGrpcService.fromProtoStage(response.currentStage),
            this.interviewGrpcService.fromProtoType(response.type),
            response.domain,
            response.targetDurationMinutes,
            response.selfIntroduction,
            response.interviewerRoles.map((role) => this.interviewGrpcService.fromProtoRole(role)),
            this.interviewGrpcService.fromProtoPersonality(response.personality),
            response.interviewerCount,
            response.createdAt || "",
            response.resumedAt || "",
        );
    }
}
