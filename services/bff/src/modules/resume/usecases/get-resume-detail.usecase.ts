import { Injectable, NotFoundException } from "@nestjs/common";
import { ResumeGrpcService } from "src/infra/grpc/services/resume-grpc.service";

export class GetResumeDetailCommand {
    constructor(
        public readonly resumeId: string,
        public readonly userId: string,
    ) {}
}

export class ResumeDetail {
    constructor(
        public readonly id: string,
        public readonly title: string,
        public readonly content: string,
        public readonly status: string,
        public readonly createdAt: string,
        public readonly fileUrl: string,
    ) {}
}

export class GetResumeDetailResult {
    constructor(public readonly resume: ResumeDetail) {}
}

@Injectable()
export class GetResumeDetailUseCase {
    constructor(private readonly resumeGrpcService: ResumeGrpcService) {}

    async execute(command: GetResumeDetailCommand): Promise<GetResumeDetailResult> {
        const response = await this.resumeGrpcService.getResume({
            resumeId: command.resumeId,
            userId: command.userId,
        });

        if (!response.resume) {
            throw new NotFoundException("이력서를 찾을 수 없습니다.");
        }

        return new GetResumeDetailResult(response.resume);
    }
}
