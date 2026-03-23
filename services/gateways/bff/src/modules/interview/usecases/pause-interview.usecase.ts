import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "../../../infra/grpc/services/interview-grpc.service";

export class PauseInterviewCommand {
    constructor(public readonly interviewId: string) {}
}

@Injectable()
export class PauseInterviewUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: PauseInterviewCommand): Promise<{
        interviewId: string;
        status: string;
        pausedAt: string;
    }> {
        return await this.interviewGrpcService.pauseInterview(command.interviewId);
    }
}
