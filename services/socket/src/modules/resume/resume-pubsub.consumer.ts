import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { RedisClient } from "../../infrastructure/redis/redis.clients.js";
import { ResumeGateway } from "./resume.gateway.js";

/**
 * Resume Pub/Sub Consumer
 * Redis Pub/Sub에서 resume:processed 채널을 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class ResumePubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private subscriber: ReturnType<typeof RedisClient.prototype.duplicate>;

    constructor(
        private readonly redisClient: RedisClient,
        private readonly resumeGateway: ResumeGateway,
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

        console.log("✅ Resume PubSub Consumer started");
    }

    private handleResumeProcessed(message: string) {
        try {
            const payload = JSON.parse(message);
            const { userId, resumeId, status } = payload;

            if (!userId) {
                console.warn("⚠️ Resume notification missing userId:", payload);
                return;
            }

            // 특정 사용자 룸에 전송
            const userRoom = `user-${userId}`;
            this.resumeGateway.server.to(userRoom).emit("resume:processed", {
                resumeId,
                status,
                timestamp: new Date().toISOString(),
            });

            console.log(
                `🔔 Resume notification sent to ${userRoom}: resumeId=${resumeId}, status=${status}`,
            );
        } catch (error) {
            console.error("❌ Resume notification handling error:", error);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.unsubscribe();
        await this.subscriber.quit();
    }
}
