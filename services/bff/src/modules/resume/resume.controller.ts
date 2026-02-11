import {
    Controller,
    Post,
    Get,
    Delete,
    Query,
    Param,
    UseGuards,
    Body,
    HttpCode,
    HttpStatus,
} from "@nestjs/common";
import { ApiOperation, ApiBody } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { GetResumesCommand, GetResumesUseCase } from "./usecases/get-resumes.usecase";
import {
    GetResumeUploadUrlCommand,
    GetResumeUploadUrlUseCase,
} from "./usecases/get-resume-upload-url.usecase";
import {
    CompleteResumeUploadCommand,
    CompleteResumeUploadUseCase,
} from "./usecases/complete-resume-upload.usecase";
import {
    GetResumeDetailCommand,
    GetResumeDetailUseCase,
} from "./usecases/get-resume-detail.usecase";
import { DeleteResumeCommand, DeleteResumeUseCase } from "./usecases/delete-resume.usecase";
import {
    ValidateResumeContentCommand,
    ValidateResumeContentUseCase,
} from "./usecases/validate-resume-content.usecase";

@Controller({ path: "resumes", version: "1" })
@UseGuards(JwtAuthGuard)
export class ResumeController {
    constructor(
        private readonly getResumesUseCase: GetResumesUseCase,
        private readonly getResumeUploadUrlUseCase: GetResumeUploadUrlUseCase,
        private readonly completeResumeUploadUseCase: CompleteResumeUploadUseCase,
        private readonly getResumeDetailUseCase: GetResumeDetailUseCase,
        private readonly deleteResumeUseCase: DeleteResumeUseCase,
        private readonly validateResumeContentUseCase: ValidateResumeContentUseCase,
    ) {}

    @Get()
    @ApiOperation({ summary: "이력서 목록 조회" })
    async getResumes(@CurrentUser() user: { userId: string }) {
        return await this.getResumesUseCase.execute(new GetResumesCommand(user.userId));
    }

    @Get("upload-url")
    @ApiOperation({ summary: "이력서 업로드 URL 발급" })
    async getUploadUrl(
        @Query("fileName") fileName: string,
        @Query("title") title: string,
        @CurrentUser() user: { userId: string },
    ) {
        return await this.getResumeUploadUrlUseCase.execute(
            new GetResumeUploadUrlCommand(user.userId, fileName, title),
        );
    }

    @Post("complete")
    @ApiOperation({ summary: "이력서 업로드 완료 처리" })
    async completeUpload(
        @Body("resumeId") resumeId: string,
        @Body("validationText") validationText: string,
        @Body("embedding") embedding: number[],
        @Body("existingResumeId") existingResumeId?: string,
    ) {
        return await this.completeResumeUploadUseCase.execute(
            new CompleteResumeUploadCommand(resumeId, validationText, embedding, existingResumeId),
        );
    }

    @Get(":resumeId")
    @ApiOperation({ summary: "이력서 상세 조회" })
    async getResume(@Param("resumeId") resumeId: string, @CurrentUser() user: { userId: string }) {
        return await this.getResumeDetailUseCase.execute(
            new GetResumeDetailCommand(resumeId, user.userId),
        );
    }

    @Post("validate-content")
    @ApiOperation({ summary: "이력서 내용 유효성 검사 (LLM)" })
    @ApiBody({ schema: { type: "object", properties: { text: { type: "string" } } } })
    async validateContent(@Body() body: { text: string }) {
        return await this.validateResumeContentUseCase.execute(
            new ValidateResumeContentCommand(body.text),
        );
    }

    @Delete(":resumeId")
    @ApiOperation({ summary: "이력서 삭제" })
    async deleteResume(
        @Param("resumeId") resumeId: string,
        @CurrentUser() user: { userId: string },
    ) {
        return await this.deleteResumeUseCase.execute(
            new DeleteResumeCommand(resumeId, user.userId),
        );
    }
}
