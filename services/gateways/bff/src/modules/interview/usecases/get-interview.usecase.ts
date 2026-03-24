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
        public readonly scheduledDurationMinutes: number,
        public readonly selfIntroduction: string,
        public readonly participatingPersonas: InterviewRole[],
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
            this.interviewGrpcService.fromProtoStage(response.currentStage),
            this.interviewGrpcService.fromProtoType(response.type),
            response.domain,
            response.scheduledDurationMinutes, // updated
            "", // placeholder
            (response.participatingPersonas || []).map(
                (role) => InterviewRole[role as keyof typeof InterviewRole],
            ), // updated
            InterviewPersonality.RANDOM, // placeholder
            (response.participatingPersonas || []).length, // derived
            response.createdAt || "",
            response.resumedAt || "",
        );
    }
}
