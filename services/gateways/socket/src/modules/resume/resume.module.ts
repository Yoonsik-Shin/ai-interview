import { Module } from "@nestjs/common";
import { ResumePubSubConsumer } from "./resume-pubsub.consumer.js";
import { ResumeConnectionListener } from "./listeners/resume-connection.listener.js";
import { ResumeGateway } from "./resume.gateway.js";
import { NotifyResumeProcessedUseCase } from "./usecases/notify-resume-processed.usecase.js";
import { RedisModule } from "../../infra/redis/redis.module.js";
import { LoggingModule } from "../../core/logging/logging.module.js";

@Module({
    imports: [RedisModule, LoggingModule],
    providers: [
        ResumePubSubConsumer,
        ResumeConnectionListener,
        ResumeGateway,
        NotifyResumeProcessedUseCase,
    ],
})
export class ResumeModule {}
