import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";

export class GetRecordingSegmentUploadUrlCommand {
    constructor(
        public readonly interviewId: string,
        public readonly turnCount: number,
    ) {}
}

@Injectable()
export class GetRecordingSegmentUploadUrlUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(
        command: GetRecordingSegmentUploadUrlCommand,
    ): Promise<{ uploadUrl: string; objectKey: string }> {
        return this.interviewGrpcService.getRecordingSegmentUploadUrl(
            command.interviewId,
            command.turnCount,
        );
    }
}
