import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { RedisClient } from "@/infrastructure/redis/redis.clients.js";
import { InterviewGateway } from "./interview.gateway.js";

/**
 * Transcript Pub/Sub Consumer
 * Redis Pub/Sub에서 LLM 토큰을 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class TranscriptPubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private subscriber: ReturnType<typeof RedisClient.prototype.duplicate>;

    constructor(
        private readonly redisClient: RedisClient,
        private readonly interviewGateway: InterviewGateway,
    ) {}

    async onModuleInit() {
        this.subscriber = this.redisClient.duplicate();
        // Auto-connects or psubscribe will connect

        // Set up message handler before subscribing
        this.subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
            this.handleTranscript(message);
        });

        // 패턴 구독: interview:transcript:*
        await this.subscriber.psubscribe("interview:transcript:*");

        console.log("✅ Transcript PubSub Consumer started");
    }

    private handleTranscript(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewId = payload.interviewId;

            // WebSocket으로 토큰 전송
            this.interviewGateway.server
                .to(`interview:${interviewId}`)
                .emit("interview:transcript", {
                    token: payload.token,
                    timestamp: payload.timestamp,
                });
        } catch (error) {
            console.error("❌ Transcript handling error:", error);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
