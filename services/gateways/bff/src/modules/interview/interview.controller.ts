import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
    CreateInterviewUseCase,
    CreateInterviewCommand,
} from "./usecases/create-interview.usecase";
import { GetInterviewsUseCase, GetInterviewsCommand } from "./usecases/get-interviews.usecase";
import { GetInterviewUseCase, GetInterviewCommand } from "./usecases/get-interview.usecase";
import {
    GetInterviewHistoryUseCase,
    GetInterviewHistoryCommand,
} from "./usecases/get-interview-history.usecase";
import {
    CompleteInterviewUseCase,
    CompleteInterviewCommand,
} from "./usecases/complete-interview.usecase";
import {
    CancelInterviewUseCase,
    CancelInterviewCommand,
} from "./usecases/cancel-interview.usecase";
import { PauseInterviewUseCase, PauseInterviewCommand } from "./usecases/pause-interview.usecase";
import {
    ResumeInterviewUseCase,
    ResumeInterviewCommand,
} from "./usecases/resume-interview.usecase";
import { CreateInterviewRequestDto } from "./dto/request/create-interview-request.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller({ path: "interviews", version: "1" })
export class InterviewController {
    constructor(
        private readonly createInterviewUseCase: CreateInterviewUseCase,
        private readonly getInterviewsUseCase: GetInterviewsUseCase,
        private readonly getInterviewUseCase: GetInterviewUseCase,
        private readonly getInterviewHistoryUseCase: GetInterviewHistoryUseCase,
        private readonly completeInterviewUseCase: CompleteInterviewUseCase,
        private readonly cancelInterviewUseCase: CancelInterviewUseCase,
        private readonly pauseInterviewUseCase: PauseInterviewUseCase,
        private readonly resumeInterviewUseCase: ResumeInterviewUseCase,
    ) {}

    @Get()
    @UseGuards(JwtAuthGuard)
    async getInterviews(
        @CurrentUser() user: { userId: string },
        @Query("status") status?: string,
        @Query("limit") limit?: number,
        @Query("sort") sort?: string,
    ) {
        return await this.getInterviewsUseCase.execute(
            new GetInterviewsCommand(user.userId, status, limit, sort),
        );
    }

    @Get(":id")
    @UseGuards(JwtAuthGuard)
    async getInterview(@Param("id") id: string) {
        return await this.getInterviewUseCase.execute(new GetInterviewCommand(id));
    }

    @Get(":id/history")
    @UseGuards(JwtAuthGuard)
    async getInterviewHistory(@Param("id") id: string) {
        return await this.getInterviewHistoryUseCase.execute(new GetInterviewHistoryCommand(id));
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createInterview(
        @CurrentUser() user: { userId: string },
        @Body() dto: CreateInterviewRequestDto,
    ) {
        return await this.createInterviewUseCase.execute(
            new CreateInterviewCommand(
                user.userId,
                dto.domain,
                dto.type,
                dto.interviewerRoles,
                dto.personality,
                dto.targetDurationMinutes,
                dto.selfIntroduction,
                dto.resumeId,
                dto.companyName,
            ),
        );
    }

    @Post(":id/complete")
    @UseGuards(JwtAuthGuard)
    async completeInterview(@Param("id") id: string) {
        return await this.completeInterviewUseCase.execute(new CompleteInterviewCommand(id));
    }

    @Post(":id/cancel")
    @UseGuards(JwtAuthGuard)
    async cancelInterview(@Param("id") id: string, @Body("reason") reason?: string) {
        return await this.cancelInterviewUseCase.execute(new CancelInterviewCommand(id, reason));
    }

    @Post(":id/pause")
    @UseGuards(JwtAuthGuard)
    async pauseInterview(@Param("id") id: string) {
        return await this.pauseInterviewUseCase.execute(new PauseInterviewCommand(id));
    }

    @Post(":id/resume")
    @UseGuards(JwtAuthGuard)
    async resumeInterview(@Param("id") id: string) {
        return await this.resumeInterviewUseCase.execute(new ResumeInterviewCommand(id));
    }
}
