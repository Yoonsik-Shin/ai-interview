import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import {
    ResumeServiceClient,
    GetUploadUrlRequest,
    GetUploadUrlResponse,
    CompleteUploadRequest,
    CompleteUploadResponse,
    ListResumesRequest,
    ListResumesResponse,
    GetResumeRequest,
    GetResumeResponse,
    DeleteResumeRequest,
    DeleteResumeResponse,
    GetResumeEmbeddingsRequest,
    GetResumeEmbeddingsResponse,
    ValidateResumeResponse,
} from "@grpc-types/resume";

@Injectable()
export class ResumeGrpcService implements OnModuleInit {
    private resumeService: ResumeServiceClient;

    constructor(@Inject("RESUME_PACKAGE") private readonly resumeClient: ClientGrpc) {}

    onModuleInit() {
        this.resumeService = this.resumeClient.getService<ResumeServiceClient>("ResumeService");
    }

    async getUploadUrl(request: GetUploadUrlRequest): Promise<GetUploadUrlResponse> {
        return await firstValueFrom(this.resumeService.getUploadUrl(request));
    }

    async completeUpload(request: CompleteUploadRequest): Promise<CompleteUploadResponse> {
        return await firstValueFrom(this.resumeService.completeUpload(request));
    }

    async listResumes(request: ListResumesRequest): Promise<ListResumesResponse> {
        return await firstValueFrom(this.resumeService.listResumes(request));
    }

    async getResume(request: GetResumeRequest): Promise<GetResumeResponse> {
        return await firstValueFrom(this.resumeService.getResume(request));
    }

    async deleteResume(request: DeleteResumeRequest): Promise<DeleteResumeResponse> {
        return await firstValueFrom(this.resumeService.deleteResume(request));
    }

    async getResumeEmbeddings(
        request: GetResumeEmbeddingsRequest,
    ): Promise<GetResumeEmbeddingsResponse> {
        return await firstValueFrom(this.resumeService.getResumeEmbeddings(request));
    }

    async classifyResume(text: string): Promise<ValidateResumeResponse> {
        return await firstValueFrom(this.resumeService.validateResume({ text }));
    }
}
