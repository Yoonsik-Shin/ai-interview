import {
    Controller,
    Post,
    Get,
    Delete,
    Query,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Body,
    HttpCode,
    HttpStatus,
    NotFoundException,
} from "@nestjs/common";
import { ApiOperation, ApiBody, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ResumesService } from "./resume.service";

@Controller({ path: "resumes", version: "1" })
@UseGuards(JwtAuthGuard)
export class ResumesController {
    constructor(private readonly resumesService: ResumesService) {}

    @Get()
    async listResumes(@CurrentUser() user: { userId: string }) {
        return this.resumesService.listResumes(user.userId);
    }

    @Get("upload-url")
    async getUploadUrl(
        @Query("fileName") fileName: string,
        @Query("title") title: string,
        @CurrentUser() user: { userId: string },
    ) {
        return this.resumesService.getUploadUrl(user.userId, fileName, title);
    }

    @Post("complete")
    @HttpCode(HttpStatus.OK)
    async completeUpload(
        @Body("resumeId") resumeId: string,
        @Body("validationText") validationText?: string,
        @Body("embedding") embedding?: number[],
    ) {
        return this.resumesService.completeUpload(resumeId, validationText, embedding);
    }

    @Get(":id")
    async getResume(@Param("id") resumeId: string, @CurrentUser() user: { userId: string }) {
        const resume = await this.resumesService.getResume(resumeId, user.userId);
        if (!resume) {
            throw new NotFoundException("이력서를 찾을 수 없습니다.");
        }
        return resume;
    }

    @Post("upload")
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor("file"))
    async uploadResume(
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body() body: any,
        @CurrentUser() user: { userId: string },
    ) {
        const title = body.title;
        if (!file) {
            throw new Error("File is required");
        }

        const result = await this.resumesService.uploadResume(
            user.userId,
            title || file.originalname,
            file.buffer,
            file.originalname,
            file.mimetype,
            body.validationText,
            body.embedding ? JSON.parse(body.embedding) : undefined,
        );

        return {
            resumeId: result.resumeId,
            message: "이력서가 성공적으로 업로드되었습니다.",
        };
    }

    @Post("update")
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor("file"))
    async updateResume(
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body() body: any,
        @CurrentUser() user: { userId: string },
    ) {
        if (!file) {
            throw new Error("File is required");
        }

        const result = await this.resumesService.updateResume(
            user.userId,
            body.existingResumeId,
            body.title || file.originalname,
            file.buffer,
            file.originalname,
            file.mimetype,
            body.embedding ? JSON.parse(body.embedding) : undefined,
        );

        return {
            resumeId: result.resumeId,
            message: "이력서가 성공적으로 업데이트되었습니다.",
        };
    }

    @Post("validate-content")
    @ApiOperation({ summary: "이력서 내용 유효성 검사 (LLM)" })
    @ApiBody({ schema: { type: "object", properties: { text: { type: "string" } } } })
    async validateContent(@Body() body: { text: string }) {
        return this.resumesService.validateContent(body.text);
    }

    @Delete(":id")
    @ApiOperation({ summary: "이력서 삭제" })
    async deleteResume(@Param("id") resumeId: string, @CurrentUser() user: { userId: string }) {
        const success = await this.resumesService.deleteResume(resumeId, user.userId);
        if (!success) {
            throw new NotFoundException("이력서를 찾을 수 없거나 권한이 없습니다.");
        }
        return { success, message: "이력서가 성공적으로 삭제되었습니다." };
    }
}
