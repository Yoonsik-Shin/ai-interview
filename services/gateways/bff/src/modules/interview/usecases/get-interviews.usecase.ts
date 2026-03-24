import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";
import { InterviewType } from "../enum/interview.enum";

export class GetInterviewsCommand {
    constructor(
        public readonly userId: string,
        public readonly status?: string,
        public readonly limit?: number,
        public readonly sort?: string,
    ) {}
}

export class InterviewSummary {
    constructor(
        public readonly interviewId: string,
        public readonly startedAt: string,
        public readonly status: string,
        public readonly domain: string,
        public readonly type: InterviewType,
        public readonly scheduledDurationMinutes: number,
        public readonly interviewerCount: number,
    ) {}
}

export class GetInterviewsResult {
    constructor(public readonly interviews: InterviewSummary[]) {}
}

@Injectable()
export class GetInterviewsUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: GetInterviewsCommand): Promise<GetInterviewsResult> {
        const statuses = command.status
            ? command.status.split(",").map((s) => this.interviewGrpcService.toProtoStatus(s))
            : [];

        const response = await this.interviewGrpcService.listInterviews({
            userId: command.userId,
            status: statuses,
            limit: command.limit ?? 0,
            sort: command.sort ?? "",
        });

        return new GetInterviewsResult(
            response.interviews.map(
                (interview) =>
                    new InterviewSummary(
                        interview.interviewId,
                        interview.startedAt,
                        this.interviewGrpcService.fromProtoStatus(interview.status),
                        interview.domain,
                        this.interviewGrpcService.fromProtoType(interview.type),
                        interview.scheduledDurationMinutes,
                        0,
                    ),
            ),
        );
    }
}
