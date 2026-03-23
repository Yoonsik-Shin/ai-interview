import { Injectable, NotFoundException } from "@nestjs/common";
import { ResumeGrpcService } from "src/infra/grpc/services/resume-grpc.service";

export class DeleteResumeCommand {
    constructor(
        public readonly resumeId: string,
        public readonly userId: string,
    ) {}
}

export class DeleteResumeResult {
    constructor(
        public readonly success: boolean,
        public readonly message: string,
    ) {}
}

@Injectable()
export class DeleteResumeUseCase {
    constructor(private readonly resumeGrpcService: ResumeGrpcService) {}

    async execute(command: DeleteResumeCommand): Promise<DeleteResumeResult> {
        const response = await this.resumeGrpcService.deleteResume({
            resumeId: command.resumeId,
            userId: command.userId,
        });

        if (!response.success) {
            throw new NotFoundException("이력서를 찾을 수 없거나 권한이 없습니다.");
        }

        return new DeleteResumeResult(true, "이력서가 성공적으로 삭제되었습니다.");
    }
}
