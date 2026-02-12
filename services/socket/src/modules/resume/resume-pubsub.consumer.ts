import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisClient } from "../../infra/redis/redis.clients.js";
import { ResumeGateway } from "./resume.gateway.js";
import {
    NotifyResumeProcessedUseCase,
    NotifyResumeProcessedCommand,
} from "./usecases/notify-resume-processed.usecase.js";

/**
 * Resume Pub/Sub Consumer
 * Redis Pub/Sub에서 resume:processed 채널을 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class ResumePubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ResumePubSubConsumer.name);
    private subscriber: ReturnType<typeof RedisClient.prototype.duplicate>;

    constructor(
        private readonly redisClient: RedisClient,
        private readonly resumeGateway: ResumeGateway,
        private readonly notifyResumeProcessedUseCase: NotifyResumeProcessedUseCase,
    ) {}

    async onModuleInit() {
        this.subscriber = this.redisClient.duplicate();

        // 메세지 핸들러 등록
        this.subscriber.on("message", (channel: string, message: string) => {
            if (channel === "resume:processed") {
                this.handleResumeProcessed(message);
            }
        });

        // 구독 시작
        await this.subscriber.subscribe("resume:processed");

        this.logger.log("Resume PubSub Consumer started");
    }

    private handleResumeProcessed(message: string) {
        try {
            const payload = JSON.parse(message);
            const { userId, resumeId, status } = payload;

            if (!userId) {
                this.logger.warn(`Resume notification missing userId: ${JSON.stringify(payload)}`);
                return;
            }

            void this.notifyResumeProcessedUseCase.execute(
                new NotifyResumeProcessedCommand(
                    this.resumeGateway.server,
                    userId,
                    resumeId,
                    status,
                ),
            );

            this.logger.log(
                `Resume notification sent to user-${userId}: resumeId=${resumeId}, status=${status}`,
            );
        } catch (error) {
            this.logger.error(`Resume notification handling error: ${error.message}`, error.stack);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.unsubscribe();
        await this.subscriber.quit();
    }
}
