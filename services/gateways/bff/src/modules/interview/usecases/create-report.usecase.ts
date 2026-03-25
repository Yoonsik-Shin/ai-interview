import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";

export class CreateReportCommand {
    constructor(public readonly interviewId: string) {}
}

export class CreateReportResult {
    constructor(
        public readonly reportId: string,
        public readonly generationStatus: string,
    ) {}
}

@Injectable()
export class CreateReportUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: CreateReportCommand): Promise<CreateReportResult> {
        const response = await this.interviewGrpcService.createInterviewReport(command.interviewId);
        return new CreateReportResult(response.reportId, response.generationStatus);
    }
}
