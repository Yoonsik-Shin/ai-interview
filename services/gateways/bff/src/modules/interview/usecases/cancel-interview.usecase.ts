import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "../../../infra/grpc/services/interview-grpc.service";

export class CancelInterviewCommand {
    constructor(
        public readonly interviewId: string,
        public readonly reason?: string,
    ) {}
}

@Injectable()
export class CancelInterviewUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: CancelInterviewCommand) {
        const response = await this.interviewGrpcService.cancelInterview(
            command.interviewId,
            command.reason,
        );

        return {
            interviewId: response.interviewId,
            status: response.status,
            endedAt: response.endedAt,
        };
    }
}
