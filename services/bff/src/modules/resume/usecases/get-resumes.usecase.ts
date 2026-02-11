import { Injectable } from "@nestjs/common";
import { ResumeGrpcService } from "src/infra/grpc/services/resume-grpc.service";

export class GetResumesCommand {
    constructor(public readonly userId: string) {}
}

export class ResumeSummary {
    constructor(
        public readonly id: string,
        public readonly title: string,
        public readonly status: string,
        public readonly createdAt: string,
        public readonly embedding?: number[],
    ) {}
}

export class GetResumesResult {
    constructor(public readonly resumes: ResumeSummary[]) {}
}

@Injectable()
export class GetResumesUseCase {
    constructor(private readonly resumeGrpcService: ResumeGrpcService) {}

    async execute(command: GetResumesCommand): Promise<GetResumesResult> {
        const resumeList = await this.resumeGrpcService.listResumes({ userId: command.userId });

        const resumes = resumeList.resumes.map(
            (resume) => new ResumeSummary(resume.id, resume.title, resume.status, resume.createdAt),
        );

        return new GetResumesResult(resumes);
    }
}
