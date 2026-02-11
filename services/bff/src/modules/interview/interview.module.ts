import { Module } from "@nestjs/common";
import { InterviewController } from "./interview.controller";
import { CreateInterviewUseCase } from "./usecases/create-interview.usecase";
import { GetInterviewsUseCase } from "./usecases/get-interviews.usecase";

@Module({
    controllers: [InterviewController],
    providers: [CreateInterviewUseCase, GetInterviewsUseCase],
})
export class InterviewModule {}
