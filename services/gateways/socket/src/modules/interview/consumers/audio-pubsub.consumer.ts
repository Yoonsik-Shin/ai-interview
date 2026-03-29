import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisClient } from "../../../infra/redis/redis.clients.js";
import { InterviewGateway } from "../interview.gateway.js";
import { SendAudioDataUseCase, SendAudioDataCommand } from "../usecases/send-audio-data.usecase.js";
import { DebugTraceGateway } from "../../debug/debug-trace.gateway";

/**
 * Audio Pub/Sub Consumer
 * Redis Pub/Sub에서 TTS 음성 데이터를 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class AudioPubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AudioPubSubConsumer.name);
    private subscriber: ReturnType<typeof RedisClient.prototype.duplicate>;

    constructor(
        private readonly redisClient: RedisClient,
        private readonly interviewGateway: InterviewGateway,
        private readonly sendAudioDataUseCase: SendAudioDataUseCase,
        private readonly debugTraceGateway: DebugTraceGateway,
    ) {}

    async onModuleInit() {
        this.subscriber = this.redisClient.duplicate();

        // Set up message handler before subscribing
        this.subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
            this.handleAudio(message);
        });

        // 패턴 구독: interview:tts:pubsub:* (표준화된 경로)
        const ttsPattern = process.env.REDIS_TTS_PUBSUB_PATTERN || "interview:audio:pubsub:*";
        await this.subscriber.psubscribe(ttsPattern);

        this.logger.log("Audio PubSub Consumer started");
    }

    private handleAudio(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewId = payload.interviewId;

            if (!interviewId) {
                this.logger.error("Missing interviewId in TTS payload");
                return;
            }

            void this.sendAudioDataUseCase.execute(
                new SendAudioDataCommand(
                    this.interviewGateway.server,
                    interviewId,
                    payload.sentenceIndex,
                    payload.audioData,
                    payload.duration,
                    payload.persona,
                    payload.text,
                ),
            );

            // 트레이스 발행 (개발 환경 전용, 비차단)
            if (process.env.NODE_ENV === "development") {
                this.debugTraceGateway.broadcastTrace(interviewId, "TTS", {
                    sentenceIndex: payload.sentenceIndex,
                    text: payload.text,
                    duration: payload.duration,
                    persona: payload.persona,
                });
            }
        } catch (error) {
            this.logger.error(`Audio handling error: ${error.message}`, error.stack);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
