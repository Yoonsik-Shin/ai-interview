import { Module } from "@nestjs/common";
import { GrpcModule } from "src/infra/grpc/grpc.module";
import { ResumeController } from "./resume.controller";
import { GetResumesUseCase } from "./usecases/get-resumes.usecase";
import { GetResumeUploadUrlUseCase } from "./usecases/get-resume-upload-url.usecase";
import { CompleteResumeUploadUseCase } from "./usecases/complete-resume-upload.usecase";
import { GetResumeDetailUseCase } from "./usecases/get-resume-detail.usecase";
import { DeleteResumeUseCase } from "./usecases/delete-resume.usecase";
import { ValidateResumeContentUseCase } from "./usecases/validate-resume-content.usecase";

@Module({
    imports: [GrpcModule],
    controllers: [ResumeController],
    providers: [
        GetResumesUseCase,
        GetResumeUploadUrlUseCase,
        CompleteResumeUploadUseCase,
        GetResumeDetailUseCase,
        DeleteResumeUseCase,
        ValidateResumeContentUseCase,
    ],
})
export class ResumeModule {}
