import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "../../../infra/grpc/services/interview-grpc.service";

export class ResumeInterviewCommand {
    constructor(public readonly interviewId: string) {}
}

@Injectable()
export class ResumeInterviewUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: ResumeInterviewCommand): Promise<{
        interviewId: string;
        status: string;
        resumedAt: string;
    }> {
        return await this.interviewGrpcService.resumeInterview(command.interviewId);
    }
}
