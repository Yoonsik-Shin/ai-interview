import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisClient } from "../../../infra/redis/redis.clients.js";
import { InterviewGateway } from "../interview.gateway.js";
import { SendAudioDataUseCase, SendAudioDataCommand } from "../usecases/send-audio-data.usecase.js";

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
    ) {}

    async onModuleInit() {
        this.subscriber = this.redisClient.duplicate();

        // Set up message handler before subscribing
        this.subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
            this.handleAudio(message);
        });

        // 패턴 구독: interview:audio:*
        await this.subscriber.psubscribe("interview:audio:*");

        this.logger.log("Audio PubSub Consumer started");
    }

    private handleAudio(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewSessionId = payload.interviewSessionId;

            if (!interviewSessionId) {
                this.logger.error("Missing interviewSessionId in TTS payload");
                return;
            }

            void this.sendAudioDataUseCase.execute(
                new SendAudioDataCommand(
                    this.interviewGateway.server,
                    interviewSessionId,
                    payload.sentenceIndex,
                    payload.audioData,
                    payload.duration,
                ),
            );
        } catch (error) {
            this.logger.error(`Audio handling error: ${error.message}`, error.stack);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
