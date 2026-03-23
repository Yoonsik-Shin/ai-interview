import { Injectable } from "@nestjs/common";
import { ResumeGrpcService } from "src/infra/grpc/services/resume-grpc.service";

export class ValidateResumeContentCommand {
    constructor(public readonly text: string) {}
}

export class ValidateResumeContentResult {
    constructor(
        public readonly isResume: boolean,
        public readonly reason: string,
        public readonly score: number,
    ) {}
}

@Injectable()
export class ValidateResumeContentUseCase {
    constructor(private readonly resumeGrpcService: ResumeGrpcService) {}

    async execute(command: ValidateResumeContentCommand): Promise<ValidateResumeContentResult> {
        const response = await this.resumeGrpcService.classifyResume(command.text);

        return new ValidateResumeContentResult(response.isResume, response.reason, response.score);
    }
}
