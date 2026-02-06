import {
    Controller,
    Post,
    Get,
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
    async completeUpload(@Body("resumeId") resumeId: string) {
        return this.resumesService.completeUpload(resumeId);
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
        @Body("title") title: string,
        @CurrentUser() user: { userId: string },
    ) {
        if (!file) {
            throw new Error("File is required");
        }

        const result = await this.resumesService.uploadResume(
            user.userId,
            title || file.originalname,
            file.buffer,
            file.originalname,
            file.mimetype,
        );

        return {
            resumeId: result.resumeId,
            message: "이력서가 성공적으로 업로드되었습니다.",
        };
    }
}
