import { Injectable } from "@nestjs/common";
import { InterviewType, InterviewRole, InterviewPersonality } from "../enum/interview.enum";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";

export class CreateInterviewCommand {
    constructor(
        public readonly userId: string,
        public readonly domain: string,
        public readonly type: InterviewType,
        public readonly participatingPersonas: InterviewRole[],
        public readonly personality: InterviewPersonality,
        public readonly scheduledDurationMinutes: number,
        public readonly resumeId?: string,
        public readonly companyName?: string,
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
            companyName: command.companyName ?? "",
            domain: command.domain,
            type: this.interviewGrpcService.toProtoType(command.type),
            participatingPersonas: command.participatingPersonas.map((r) => r.toString()),
            scheduledDurationMinutes: command.scheduledDurationMinutes,
            resumeId: command.resumeId,
        });

        return new CreateInterviewResult(
            response.interviewId,
            this.interviewGrpcService.fromProtoStatus(response.status),
        );
    }
}
