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
        const [resumeList, embeddingList] = await Promise.all([
            this.resumeGrpcService.listResumes({ userId: command.userId }),
            this.resumeGrpcService.getResumeEmbeddings({ userId: command.userId }),
        ]);

        const embeddingMap = new Map<string, number[]>();
        if (embeddingList.embeddings) {
            embeddingList.embeddings.forEach((item) => {
                embeddingMap.set(item.resumeId, item.vector);
            });
        }

        const resumes = resumeList.resumes.map(
            (resume) =>
                new ResumeSummary(
                    resume.id,
                    resume.title,
                    resume.status,
                    resume.createdAt,
                    embeddingMap.get(resume.id),
                ),
        );

        return new GetResumesResult(resumes);
    }
}
