import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
    CreateInterviewUseCase,
    CreateInterviewCommand,
} from "./usecases/create-interview.usecase";
import { GetInterviewsUseCase, GetInterviewsCommand } from "./usecases/get-interviews.usecase";
import { CreateInterviewRequestDto } from "./dto/request/create-interview-request.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller({ path: "interviews", version: "1" })
export class InterviewController {
    constructor(
        private readonly createInterviewUseCase: CreateInterviewUseCase,
        private readonly getInterviewsUseCase: GetInterviewsUseCase,
    ) {}

    @Get()
    @UseGuards(JwtAuthGuard)
    async getInterviews(@CurrentUser() user: { userId: string }) {
        return await this.getInterviewsUseCase.execute(new GetInterviewsCommand(user.userId));
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
            ),
        );
    }
}
