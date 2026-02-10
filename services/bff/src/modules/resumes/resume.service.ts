import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { lastValueFrom, firstValueFrom, type Observable } from "rxjs";
import type { ClientGrpc } from "@nestjs/microservices";
import { LlmServiceClient, LLM_SERVICE_NAME } from "../../generated/llm";

export interface ResumeItem {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    embedding?: number[];
}

export interface ResumeDetail {
    id: string;
    title: string;
    content: string;
    status: string;
    createdAt: string;
    fileUrl?: string;
}

interface ResumeServiceGrpc {
    getUploadUrl(data: {
        userId: string;
        fileName: string;
        title: string;
    }): Observable<{ uploadUrl: string; resumeId: string }>;

    completeUpload(data: {
        resumeId: string;
        validationText?: string;
        embedding?: number[];
    }): Observable<{ success: boolean }>;

    uploadResume(data: {
        userId: string;
        title: string;
        fileData: Buffer;
        fileName: string;
        contentType: string;
        validationText?: string;
        embedding?: number[];
    }): Observable<{ resumeId: string }>;

    updateResume(data: {
        userId: string;
        existingResumeId: string;
        title: string;
        fileData: Buffer;
        fileName: string;
        contentType: string;
        embedding?: number[];
    }): Observable<{ resumeId: string }>;

    listResumes(data: { userId: string }): Observable<{ resumes: ResumeItem[] }>;

    getResume(data: { resumeId: string; userId: string }): Observable<{ resume?: ResumeDetail }>;
    deleteResume(data: { resumeId: string; userId: string }): Observable<{ success: boolean }>;

    getResumeEmbeddings(data: { userId: string }): Observable<{
        embeddings: { resumeId: string; vector: number[] }[];
    }>;
}

/**
 * Resumes Service
 */
@Injectable()
export class ResumesService implements OnModuleInit {
    private resumeService: ResumeServiceGrpc;
    private llmService: LlmServiceClient;

    constructor(
        @Inject("RESUME_PACKAGE") private readonly client: ClientGrpc,
        @Inject("LLM_PACKAGE") private readonly llmClient: ClientGrpc,
    ) {}

    onModuleInit() {
        this.resumeService = this.client.getService<ResumeServiceGrpc>("ResumeService");
        this.llmService = this.llmClient.getService<LlmServiceClient>(LLM_SERVICE_NAME);
    }

    async validateContent(text: string) {
        try {
            const response = await lastValueFrom(this.llmService.classifyResume({ text }));
            return {
                isResume: response.isResume,
                reason: response.reason,
                score: response.score,
            };
        } catch (error) {
            console.error("BFF: LLM gRPC 호출 중 에러 발생", error);
            throw error;
        }
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

    async completeUpload(
        resumeId: string,
        validationText?: string,
        embedding?: number[],
    ): Promise<{ success: boolean }> {
        return firstValueFrom(
            this.resumeService.completeUpload({ resumeId, validationText, embedding }),
        );
    }

    async uploadResume(
        userId: string,
        title: string,
        fileData: Buffer,
        fileName: string,
        contentType: string,
        validationText?: string,
        embedding?: number[],
    ): Promise<{ resumeId: string }> {
        const response = await firstValueFrom(
            this.resumeService.uploadResume({
                userId,
                title,
                fileData,
                fileName,
                contentType,
                validationText,
                embedding,
            }),
        );

        return {
            resumeId: response.resumeId,
        };
    }

    async updateResume(
        userId: string,
        existingResumeId: string,
        title: string,
        fileData: Buffer,
        fileName: string,
        contentType: string,
        embedding?: number[],
    ): Promise<{ resumeId: string }> {
        const response = await firstValueFrom(
            this.resumeService.updateResume({
                userId,
                existingResumeId,
                title,
                fileData,
                fileName,
                contentType,
                embedding,
            }),
        );

        return {
            resumeId: response.resumeId,
        };
    }

    async listResumes(userId: string): Promise<ResumeItem[]> {
        try {
            // 병렬 호출: 이력서 목록 + 임베딩 목록
            const [resumeList, embeddingList] = await Promise.all([
                firstValueFrom(this.resumeService.listResumes({ userId })),
                firstValueFrom(this.resumeService.getResumeEmbeddings({ userId })).catch(() => ({
                    embeddings: [] as { resumeId: string; vector: number[] }[],
                })), // 임베딩 호출 실패해도 목록은 보여줌
            ]);

            // 임베딩 맵 생성
            const embeddingMap = new Map<string, number[]>();
            if (embeddingList && embeddingList.embeddings) {
                embeddingList.embeddings.forEach((item) => {
                    embeddingMap.set(item.resumeId, item.vector);
                });
            }

            // 결과 병합
            return (resumeList.resumes ?? []).map((resume) => ({
                ...resume,
                embedding: embeddingMap.get(resume.id),
            }));
        } catch (error) {
            console.error("BFF: listResumes error", error);
            throw error;
        }
    }

    async getResume(resumeId: string, userId: string): Promise<ResumeDetail | null> {
        const response = await firstValueFrom(this.resumeService.getResume({ resumeId, userId }));
        return response.resume ?? null;
    }

    async deleteResume(resumeId: string, userId: string): Promise<boolean> {
        const response = await firstValueFrom(
            this.resumeService.deleteResume({ resumeId, userId }),
        );
        return response.success;
    }
}
