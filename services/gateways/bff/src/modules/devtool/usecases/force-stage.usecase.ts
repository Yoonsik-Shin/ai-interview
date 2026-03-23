import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "../../../infra/grpc/services/interview-grpc.service";
import { ForceStageCommand } from "../dto/force-stage.command";

/**
 * ForceStageUseCase
 *
 * 개발 환경에서 면접 단계를 강제로 변경합니다.
 * 테스트 및 디버깅 목적으로만 사용됩니다.
 */
@Injectable()
export class ForceStageUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: ForceStageCommand) {
        const { interviewId, targetStage } = command;

        // Core 서비스에 gRPC 요청
        await this.interviewGrpcService.forceStage(interviewId, targetStage);

        return {
            interviewId,
            stage: targetStage,
            message: `Stage forcefully changed to ${targetStage}`,
        };
    }
}
