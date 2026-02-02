import {
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Body,
    HttpCode,
    HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ResumesService } from "./resume.service";

@Controller("api/v1/resumes")
@UseGuards(JwtAuthGuard)
export class ResumesController {
    constructor(private readonly resumesService: ResumesService) {}

    @Post("upload")
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor("file"))
    async uploadResume(
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body("title") title: string,
        @CurrentUser() user: { userId: number },
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
