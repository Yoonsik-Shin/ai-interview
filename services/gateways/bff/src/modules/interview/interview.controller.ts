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
import { CreateReportUseCase, CreateReportCommand } from "./usecases/create-report.usecase";
import { GetReportUseCase, GetReportQuery } from "./usecases/get-report.usecase";
import {
    GetRecordingSegmentUploadUrlUseCase,
    GetRecordingSegmentUploadUrlCommand,
} from "./usecases/get-recording-segment-upload-url.usecase";
import {
    CompleteRecordingSegmentUseCase,
    CompleteRecordingSegmentCommand,
} from "./usecases/complete-recording-segment.usecase";
import { GetRecordingSegmentsUseCase } from "./usecases/get-recording-segments.usecase";
import { CreateInterviewRequestDto } from "./dto/request/create-interview-request.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ParseIntPipe } from "@nestjs/common";

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
        private readonly createReportUseCase: CreateReportUseCase,
        private readonly getReportUseCase: GetReportUseCase,
        private readonly getRecordingSegmentUploadUrlUseCase: GetRecordingSegmentUploadUrlUseCase,
        private readonly completeRecordingSegmentUseCase: CompleteRecordingSegmentUseCase,
        private readonly getRecordingSegmentsUseCase: GetRecordingSegmentsUseCase,
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
                dto.participatingPersonas,
                dto.personality,
                dto.scheduledDurationMinutes,
                dto.round,
                dto.resumeId,
                dto.companyName,
                dto.jobPostingUrl,
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

    @Post(":id/reports")
    @UseGuards(JwtAuthGuard)
    async createReport(@Param("id") id: string) {
        return await this.createReportUseCase.execute(new CreateReportCommand(id));
    }

    @Get(":id/reports/:reportId")
    @UseGuards(JwtAuthGuard)
    async getReport(@Param("id") id: string, @Param("reportId") reportId: string) {
        return await this.getReportUseCase.execute(new GetReportQuery(id, reportId));
    }

    @Get(":id/recording-segments/upload-url")
    @UseGuards(JwtAuthGuard)
    async getRecordingSegmentUploadUrl(
        @Param("id") id: string,
        @Query("turn", ParseIntPipe) turn: number,
    ) {
        return await this.getRecordingSegmentUploadUrlUseCase.execute(
            new GetRecordingSegmentUploadUrlCommand(id, turn),
        );
    }

    @Post(":id/recording-segments/complete")
    @UseGuards(JwtAuthGuard)
    async completeRecordingSegment(
        @Param("id") id: string,
        @Body()
        body: {
            objectKey: string;
            turnCount: number;
            durationSeconds?: number;
            startedAtEpoch?: number;
            endedAtEpoch?: number;
        },
    ) {
        await this.completeRecordingSegmentUseCase.execute(
            new CompleteRecordingSegmentCommand(
                id,
                body.objectKey,
                body.turnCount,
                body.durationSeconds,
                body.startedAtEpoch,
                body.endedAtEpoch,
            ),
        );
        return { success: true };
    }

    @Get(":id/recording-segments")
    @UseGuards(JwtAuthGuard)
    async getRecordingSegments(@Param("id") id: string) {
        return await this.getRecordingSegmentsUseCase.execute(id);
    }
}
