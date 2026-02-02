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
            // WebSocket으로 음성 데이터 전송
            // Frontend는 interview-session-{interviewSessionId}를 사용
            const roomName = `interview-session-${interviewSessionId}`;

            // Redis Adapter를 사용 중이므로, 모든 Pod가 Pub/Sub 메시지를 받으면
            // server.to().emit()은 다시 브로드캐스트를 유발하여 중복 전송됩니다.
            // 따라서 현재 Pod에 연결된 클라이언트에게만 전송하도록 local flag를 사용해야 합니다.
            (this.interviewGateway.server as any).local.to(roomName).emit("interview:audio", {
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
