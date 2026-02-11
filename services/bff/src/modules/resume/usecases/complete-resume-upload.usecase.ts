import { Injectable } from "@nestjs/common";
import { ResumeGrpcService } from "src/infra/grpc/services/resume-grpc.service";

export class CompleteResumeUploadCommand {
    constructor(
        public readonly resumeId: string,
        public readonly validationText: string,
        public readonly embedding: number[],
        public readonly existingResumeId?: string,
    ) {}
}

export class CompleteResumeUploadResult {
    constructor(public readonly success: boolean) {}
}

@Injectable()
export class CompleteResumeUploadUseCase {
    constructor(private readonly resumeGrpcService: ResumeGrpcService) {}

    async execute(command: CompleteResumeUploadCommand): Promise<CompleteResumeUploadResult> {
        const response = await this.resumeGrpcService.completeUpload({
            resumeId: command.resumeId,
            validationText: command.validationText,
            embedding: command.embedding,
            existingResumeId: command.existingResumeId,
        });

        return new CompleteResumeUploadResult(response.success);
    }
}
