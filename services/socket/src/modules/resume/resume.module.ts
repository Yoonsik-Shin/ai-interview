import { Module } from "@nestjs/common";
import { ResumePubSubConsumer } from "./resume-pubsub.consumer.js";
import { ResumeConnectionListener } from "./listeners/resume-connection.listener.js";
import { ResumeGateway } from "./resume.gateway.js";
import { RedisModule } from "../../infrastructure/redis/redis.module.js";
import { LoggingModule } from "../../core/logging/logging.module.js";

@Module({
    imports: [RedisModule, LoggingModule],
    providers: [ResumePubSubConsumer, ResumeConnectionListener, ResumeGateway],
})
export class ResumeModule {}
