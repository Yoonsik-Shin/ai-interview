import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";
import { InterviewType } from "../enum/interview.enum";

export class GetInterviewsCommand {
    constructor(public readonly userId: string) {}
}

export class InterviewSessionSummary {
    constructor(
        public readonly interviewId: string,
        public readonly startedAt: string,
        public readonly status: string,
        public readonly domain: string,
        public readonly type: InterviewType,
        public readonly targetDurationMinutes: number,
        public readonly interviewerCount: number,
    ) {}
}

export class GetInterviewsResult {
    constructor(public readonly interviews: InterviewSessionSummary[]) {}
}

@Injectable()
export class GetInterviewsUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: GetInterviewsCommand): Promise<GetInterviewsResult> {
        const response = await this.interviewGrpcService.listInterviews({ userId: command.userId });

        return new GetInterviewsResult(
            response.interviews.map(
                (interview) =>
                    new InterviewSessionSummary(
                        interview.interviewId,
                        interview.startedAt,
                        this.interviewGrpcService.fromProtoStatus(interview.status),
                        interview.domain,
                        this.interviewGrpcService.fromProtoType(interview.type),
                        interview.targetDurationMinutes,
                        interview.interviewerCount,
                    ),
            ),
        );
    }
}
