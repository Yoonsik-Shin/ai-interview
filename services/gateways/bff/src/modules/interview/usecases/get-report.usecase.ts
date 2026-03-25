import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";

export class GetReportQuery {
    constructor(
        public readonly interviewId: string,
        public readonly reportId: string,
    ) {}
}

export class GetReportResult {
    constructor(
        public readonly reportId: string,
        public readonly generationStatus: string,
        public readonly totalScore: number,
        public readonly passFailStatus: string,
        public readonly summaryText: string,
        public readonly resumeFeedback: string,
    ) {}
}

@Injectable()
export class GetReportUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(query: GetReportQuery): Promise<GetReportResult> {
        const response = await this.interviewGrpcService.getInterviewReport(
            query.interviewId,
            query.reportId,
        );
        return new GetReportResult(
            response.reportId,
            response.generationStatus,
            response.totalScore,
            response.passFailStatus,
            response.summaryText,
            response.resumeFeedback,
        );
    }
}
