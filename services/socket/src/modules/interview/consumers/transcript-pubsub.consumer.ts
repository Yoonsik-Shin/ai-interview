import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisClient } from "../../../infra/redis/redis.clients.js";
import { InterviewGateway } from "../interview.gateway.js";
import {
    SendTranscriptUseCase,
    SendTranscriptCommand,
} from "../usecases/send-transcript.usecase.js";

/**
 * Transcript Pub/Sub Consumer
 * Redis Pub/Sub에서 LLM 토큰을 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class TranscriptPubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TranscriptPubSubConsumer.name);
    private subscriber: ReturnType<typeof RedisClient.prototype.duplicate>;

    constructor(
        private readonly redisClient: RedisClient,
        private readonly interviewGateway: InterviewGateway,
        private readonly sendTranscriptUseCase: SendTranscriptUseCase,
    ) {}

    async onModuleInit() {
        this.subscriber = this.redisClient.duplicate();

        // Set up message handler before subscribing
        this.subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
            this.handleTranscript(message);
        });

        // 패턴 구독: interview:transcript:*
        await this.subscriber.psubscribe("interview:transcript:*");

        this.logger.log("Transcript PubSub Consumer started");
    }

    private handleTranscript(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewId = payload.interviewId;

            if (!interviewId) return;

            void this.sendTranscriptUseCase.execute(
                new SendTranscriptCommand(this.interviewGateway.server, interviewId, payload),
            );
        } catch (error) {
            this.logger.error(`Transcript handling error: ${error.message}`, error.stack);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
