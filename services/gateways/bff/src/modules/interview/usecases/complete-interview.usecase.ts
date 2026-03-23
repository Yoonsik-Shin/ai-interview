import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "../../../infra/grpc/services/interview-grpc.service";

export class CompleteInterviewCommand {
    constructor(public readonly interviewId: string) {}
}

@Injectable()
export class CompleteInterviewUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: CompleteInterviewCommand) {
        const response = await this.interviewGrpcService.completeInterview(command.interviewId);

        return {
            interviewId: response.interviewId,
            status: response.status,
            endedAt: response.endedAt,
        };
    }
}
