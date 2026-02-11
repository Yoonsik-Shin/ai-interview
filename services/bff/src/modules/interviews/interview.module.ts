import { Module } from "@nestjs/common";
import { InterviewController } from "./interview.controller";
import { startInterviewUseCase } from "./usecases/interview.usecase";
import { ListInterviewsUseCase } from "./usecases/list-interviews.usecase";

@Module({
    controllers: [InterviewController],
    providers: [startInterviewUseCase, ListInterviewsUseCase],
})
export class InterviewModule {}
