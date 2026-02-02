import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { RedisClient } from "@/infrastructure/redis/redis.clients.js";
import { InterviewGateway } from "./interview.gateway.js";

/**
 * Audio Pub/Sub Consumer
 * Redis Pub/Sub에서 TTS 음성 데이터를 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class AudioPubSubConsumer implements OnModuleInit, OnModuleDestroy {
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
            this.handleAudio(message);
        });

        // 패턴 구독: interview:audio:*
        await this.subscriber.psubscribe("interview:audio:*");

        console.log("✅ Audio PubSub Consumer started");
    }

    private handleAudio(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewSessionId = payload.interviewSessionId; // 실제 PK (ULID)

            console.log("🎵 TTS Audio received:", {
                interviewSessionId,
                sentenceIndex: payload.sentenceIndex,
                audioDataLength: payload.audioData?.length || 0,
            });

            if (!interviewSessionId) {
                console.error("❌ Missing interviewSessionId in TTS payload");
                return;
            }

            // WebSocket으로 음성 데이터 전송
            // Frontend는 interview-session-{interviewSessionId}를 사용
            const roomName = `interview-session-${interviewSessionId}`;
            this.interviewGateway.server.to(roomName).emit("interview:audio", {
                sentenceIndex: payload.sentenceIndex,
                audioData: payload.audioData, // base64
                duration: payload.duration,
            });

            console.log(
                "✅ TTS Audio sent to room:",
                roomName,
                "sentenceIndex:",
                payload.sentenceIndex,
            );
        } catch (error) {
            console.error("❌ Audio handling error:", error);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
