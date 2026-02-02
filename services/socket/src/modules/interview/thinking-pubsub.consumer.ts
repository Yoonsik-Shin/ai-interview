import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { RedisClient } from "@/infrastructure/redis/redis.clients.js";
import { InterviewGateway } from "./interview.gateway.js";

/**
 * Thinking Pub/Sub Consumer
 * Redis Pub/Sub에서 LangGraph 노드 실행 정보를 subscribe하여 WebSocket으로 전송
 * (향후 LangGraph 통합 시 사용)
 */
@Injectable()
export class ThinkingPubSubConsumer implements OnModuleInit, OnModuleDestroy {
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
            this.handleThinking(message);
        });

        // 패턴 구독: interview:thinking:*
        await this.subscriber.psubscribe("interview:thinking:*");

        console.log("✅ Thinking PubSub Consumer started");
    }

    private handleThinking(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewId = payload.interviewId;

            // WebSocket으로 thinking 상태 전송
            this.interviewGateway.server.to(`interview:${interviewId}`).emit("interview:thinking", {
                nodeName: payload.nodeName,
                status: payload.status,
                message: payload.message,
            });
        } catch (error) {
            console.error("❌ Thinking handling error:", error);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
