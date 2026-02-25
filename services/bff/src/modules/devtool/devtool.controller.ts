import { Controller, Post, Param, Body, UseGuards } from "@nestjs/common";
import { DevToolGuard } from "../../guards/devtool.guard";
import { ForceStageUseCase } from "./usecases/force-stage.usecase";
import { ForceStageCommand } from "./dto/force-stage.command";

/**
 * DevTool Controller
 *
 * 개발 환경에서만 사용 가능한 디버깅 API를 제공합니다.
 * - 면접 단계 강제 변경
 */
@Controller({ path: "devtool", version: "1" })
@UseGuards(DevToolGuard)
export class DevToolController {
    constructor(private readonly forceStageUseCase: ForceStageUseCase) {}

    @Post("interviews/:id/force-stage")
    async forceStage(@Param("id") interviewId: string, @Body("targetStage") targetStage: string) {
        const command = new ForceStageCommand(interviewId, targetStage);
        return await this.forceStageUseCase.execute(command);
    }
}
