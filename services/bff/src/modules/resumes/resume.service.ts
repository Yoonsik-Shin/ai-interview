import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, type Observable } from "rxjs";

export interface ResumeItem {
    id: string;
    title: string;
    status: string;
    createdAt: string;
}

export interface ResumeDetail {
    id: string;
    title: string;
    content: string;
    status: string;
    createdAt: string;
}

interface ResumeServiceGrpc {
    getUploadUrl(data: {
        userId: string;
        fileName: string;
        title: string;
    }): Observable<{ uploadUrl: string; resumeId: string }>;

    completeUpload(data: { resumeId: string }): Observable<{ success: boolean }>;

    uploadResume(data: {
        userId: string;
        title: string;
        fileData: Buffer;
        fileName: string;
        contentType: string;
    }): Observable<{ resumeId: string }>;

    listResumes(data: { userId: string }): Observable<{ resumes: ResumeItem[] }>;

    getResume(data: {
        resumeId: string;
        userId: string;
    }): Observable<{ resume?: ResumeDetail }>;
}

/**
 * Resumes Service
 */
@Injectable()
export class ResumesService implements OnModuleInit {
    private resumeService: ResumeServiceGrpc;

    constructor(@Inject("RESUME_PACKAGE") private readonly client: ClientGrpc) {}

    onModuleInit() {
        this.resumeService = this.client.getService<ResumeServiceGrpc>("ResumeService");
    }

    async getUploadUrl(
        userId: string,
        fileName: string,
        title: string,
    ): Promise<{ uploadUrl: string; resumeId: string }> {
        return firstValueFrom(
            this.resumeService.getUploadUrl({
                userId,
                fileName,
                title,
            }),
        );
    }

    async completeUpload(resumeId: string): Promise<{ success: boolean }> {
        return firstValueFrom(this.resumeService.completeUpload({ resumeId }));
    }

    async uploadResume(
        userId: string,
        title: string,
        fileData: Buffer,
        fileName: string,
        contentType: string,
    ): Promise<{ resumeId: string }> {
        const response = await firstValueFrom(
            this.resumeService.uploadResume({
                userId,
                title,
                fileData,
                fileName,
                contentType,
            }),
        );

        return {
            resumeId: response.resumeId,
        };
    }

    async listResumes(userId: string): Promise<ResumeItem[]> {
        const response = await firstValueFrom(this.resumeService.listResumes({ userId }));
        return response.resumes ?? [];
    }

    async getResume(resumeId: string, userId: string): Promise<ResumeDetail | null> {
        const response = await firstValueFrom(
            this.resumeService.getResume({ resumeId, userId }),
        );
        return response.resume ?? null;
    }
}
