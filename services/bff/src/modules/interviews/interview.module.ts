import { Module } from "@nestjs/common";
import { InterviewController } from "./interview.controller";
import { startInterviewUseCase } from "./usecases/interview.usecase";

@Module({
    controllers: [InterviewController],
    providers: [startInterviewUseCase],
})
export class InterviewModule {}
