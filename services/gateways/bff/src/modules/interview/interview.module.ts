import { Module } from "@nestjs/common";
import { InterviewController } from "./interview.controller";
import { CreateInterviewUseCase } from "./usecases/create-interview.usecase";
import { GetInterviewsUseCase } from "./usecases/get-interviews.usecase";
import { GetInterviewHistoryUseCase } from "./usecases/get-interview-history.usecase";
import { CompleteInterviewUseCase } from "./usecases/complete-interview.usecase";
import { CancelInterviewUseCase } from "./usecases/cancel-interview.usecase";
import { PauseInterviewUseCase } from "./usecases/pause-interview.usecase";
import { GetInterviewUseCase } from "./usecases/get-interview.usecase";
import { ResumeInterviewUseCase } from "./usecases/resume-interview.usecase";
import { CreateReportUseCase } from "./usecases/create-report.usecase";
import { GetReportUseCase } from "./usecases/get-report.usecase";
import { GrpcModule } from "../../infra/grpc/grpc.module";

@Module({
    imports: [GrpcModule],
    controllers: [InterviewController],
    providers: [
        CreateInterviewUseCase,
        GetInterviewsUseCase,
        GetInterviewHistoryUseCase,
        CompleteInterviewUseCase,
        CancelInterviewUseCase,
        PauseInterviewUseCase,
        ResumeInterviewUseCase,
        GetInterviewUseCase,
        CreateReportUseCase,
        GetReportUseCase,
    ],
})
export class InterviewModule {}
