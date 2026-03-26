import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";

export class CompleteRecordingSegmentCommand {
    constructor(
        public readonly interviewId: string,
        public readonly objectKey: string,
        public readonly turnCount: number,
        public readonly durationSeconds?: number,
        public readonly startedAtEpoch?: number,
        public readonly endedAtEpoch?: number,
    ) {}
}

@Injectable()
export class CompleteRecordingSegmentUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: CompleteRecordingSegmentCommand): Promise<void> {
        await this.interviewGrpcService.completeRecordingSegmentUpload(
            command.interviewId,
            command.objectKey,
            command.turnCount,
            command.durationSeconds,
            command.startedAtEpoch,
            command.endedAtEpoch,
        );
    }
}
