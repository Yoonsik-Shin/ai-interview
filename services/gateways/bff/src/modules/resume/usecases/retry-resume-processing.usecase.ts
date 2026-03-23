import { Injectable } from "@nestjs/common";
import { ResumeGrpcService } from "src/infra/grpc/services/resume-grpc.service";

export class RetryResumeProcessingCommand {
    constructor(public readonly resumeId: string) {}
}

@Injectable()
export class RetryResumeProcessingUseCase {
    constructor(private readonly resumeGrpcService: ResumeGrpcService) {}

    async execute(command: RetryResumeProcessingCommand): Promise<{ success: boolean }> {
        const response = await this.resumeGrpcService.completeUpload({
            resumeId: command.resumeId,
            validationText: "",
            embedding: [],
        });
        return { success: response.success };
    }
}
