import { Injectable } from "@nestjs/common";
import { InterviewType, InterviewRole, InterviewPersonality } from "../enum/interview.enum";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";

export class CreateInterviewCommand {
    constructor(
        public readonly userId: string,
        public readonly domain: string,
        public readonly type: InterviewType,
        public readonly interviewerRoles: InterviewRole[],
        public readonly personality: InterviewPersonality,
        public readonly targetDurationMinutes: number,
        public readonly selfIntroduction: string,
        public readonly resumeId?: string,
    ) {}
}

export class CreateInterviewResult {
    constructor(
        public readonly interviewId: string,
        public readonly status: string,
    ) {}
}

@Injectable()
export class CreateInterviewUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: CreateInterviewCommand): Promise<CreateInterviewResult> {
        const response = await this.interviewGrpcService.createInterview({
            userId: command.userId,
            domain: command.domain,
            type: this.interviewGrpcService.toProtoType(command.type),
            interviewerRoles: command.interviewerRoles.map((r) =>
                this.interviewGrpcService.toProtoRole(r),
            ),
            personality: this.interviewGrpcService.toProtoPersonality(command.personality),
            interviewerCount: command.interviewerRoles.length,
            targetDurationMinutes: command.targetDurationMinutes,
            selfIntroduction: command.selfIntroduction,
            resumeId: command.resumeId,
        });

        return new CreateInterviewResult(
            response.interviewId,
            this.interviewGrpcService.fromProtoStatus(response.status),
        );
    }
}
