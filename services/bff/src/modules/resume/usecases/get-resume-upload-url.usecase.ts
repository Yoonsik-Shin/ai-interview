import { Injectable } from "@nestjs/common";
import { ResumeGrpcService } from "src/infra/grpc/services/resume-grpc.service";

export class GetResumeUploadUrlCommand {
    constructor(
        public readonly userId: string,
        public readonly fileName: string,
        public readonly title: string,
    ) {}
}

export class GetResumeUploadUrlResult {
    constructor(
        public readonly uploadUrl: string,
        public readonly resumeId: string,
    ) {}
}

@Injectable()
export class GetResumeUploadUrlUseCase {
    constructor(private readonly resumeGrpcService: ResumeGrpcService) {}

    async execute(command: GetResumeUploadUrlCommand): Promise<GetResumeUploadUrlResult> {
        const response = await this.resumeGrpcService.getUploadUrl({
            userId: command.userId,
            fileName: command.fileName,
            title: command.title,
        });

        return new GetResumeUploadUrlResult(response.uploadUrl, response.resumeId);
    }
}
