import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisClient } from "../../../infra/redis/redis.clients.js";
import { InterviewGateway } from "../interview.gateway.js";

/**
 * Storage Pub/Sub Consumer
 * Redis Pub/Sub에서 오디오 저장 완료 이벤트를 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class StoragePubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(StoragePubSubConsumer.name);
    private subscriber: ReturnType<typeof RedisClient.prototype.duplicate>;

    constructor(
        private readonly redisClient: RedisClient,
        private readonly interviewGateway: InterviewGateway,
    ) {}

    async onModuleInit() {
        this.subscriber = this.redisClient.duplicate();

        // Set up message handler before subscribing
        this.subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
            this.handleStorageCompleted(message);
        });

        // 패턴 구독: interview:audio:completed:*
        await this.subscriber.psubscribe("interview:audio:completed:*");

        this.logger.log("Storage PubSub Consumer started");
    }

    private handleStorageCompleted(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewId = payload.interviewId;

            if (!interviewId) {
                this.logger.error("Missing interviewId in storage completion payload");
                return;
            }

            this.logger.log(`Audio storage completed for interview: ${interviewId}`);

            // 클라이언트에게 저장 완료 및 URL 전달
            const roomName = `interview-session-${interviewId}`;
            this.interviewGateway.server.to(roomName).emit("interview:audio_saved", {
                interviewId,
                objectUrl: payload.objectUrl,
                timestamp: payload.timestamp,
            });
        } catch (error) {
            this.logger.error(`Storage completion handling error: ${error.message}`, error.stack);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
