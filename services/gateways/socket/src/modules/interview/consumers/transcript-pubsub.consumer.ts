import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisSubscriberClient } from "../../../infra/redis/redis.clients.js";
import { InterviewGateway } from "../interview.gateway.js";
import {
    SendTranscriptUseCase,
    SendTranscriptCommand,
} from "../usecases/send-transcript.usecase.js";
import { AudioProcessorService } from "../../stt/services/audio-processor.service.js";
import { RedisClient } from "../../../infra/redis/redis.clients.js";

/**
 * Transcript Pub/Sub Consumer
 * Redis Pub/Sub에서 LLM 토큰 및 STAGE_CHANGE 이벤트를 subscribe하여 WebSocket으로 전송
 */
@Injectable()
export class TranscriptPubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TranscriptPubSubConsumer.name);
    private subscriber: RedisSubscriberClient;

    constructor(
        private readonly redisSubscriberClient: RedisSubscriberClient,
        private readonly interviewGateway: InterviewGateway,
        private readonly sendTranscriptUseCase: SendTranscriptUseCase,
        private readonly audioProcessorService: AudioProcessorService,
        private readonly redisClient: RedisClient,
    ) {
        this.subscriber = this.redisSubscriberClient;
    }

    async onModuleInit() {
        this.logger.log("VERSION: 2026-03-26-DIAGNOSTIC-V2");

        // 연결 상태 감시 추가
        this.subscriber.on("connect", () => this.logger.log("[RedisSub] Connection Connecting..."));
        this.subscriber.on("ready", () =>
            this.logger.log("[RedisSub] Subscriber READY (Connection Established)"),
        );
        this.subscriber.on("reconnecting", () =>
            this.logger.warn("[RedisSub] Subscriber Reconnecting..."),
        );
        this.subscriber.on("error", (err) =>
            this.logger.error(`[RedisSub] Subscriber ERROR: ${err.message}`),
        );

        // [근본 해결] ioredis의 'pmessage' 이벤트를 명확히 처리
        this.subscriber.on("pmessage", (pattern: string, channel: string, message: string) => {
            const preview = message.length > 100 ? message.substring(0, 100) + "..." : message;
            this.logger.debug(`[RedisSub] RECEIVED (Channel: ${channel}): ${preview}`);
            void this.handleTranscript(message);
        });

        // 패턴 구독: interview:llm:pubsub:* & interview:stt:pubsub:*
        try {
            const transcriptPattern =
                process.env.REDIS_TRANSCRIPT_PUBSUB_PATTERN || "interview:transcript:pubsub:*";
            await this.subscriber.psubscribe(transcriptPattern);
            this.logger.log(`[RedisSub] Patterns Subscribed: ${transcriptPattern}`);
        } catch (err) {
            this.logger.error(`[RedisSub] Psubscribe Failed: ${err.message}`);
        }
    }

    private async handleTranscript(message: string) {
        try {
            // [중요] Java의 GenericJacksonJsonRedisSerializer 처리
            let cleanJson = message;
            const startIdx = message.indexOf("{");
            const endIdx = message.lastIndexOf("}");
            if (startIdx !== -1 && endIdx !== -1) {
                cleanJson = message.substring(startIdx, endIdx + 1);
            }

            const payload = JSON.parse(cleanJson);
            const interviewId = payload.interviewId as string;

            if (!interviewId) return;

            // Debug LOG for STAGE_CHANGE delivery tracking
            if (payload.type === "STAGE_CHANGE") {
                this.logger.debug(
                    `[RedisSub] STAGE_CHANGE detected for ${interviewId}: ${payload.previousStage as string} -> ${payload.currentStage as string}`,
                );
                this.audioProcessorService.resetRecordingFlag(interviewId);
            }

            if (payload.type === "turn_state") {
                const rtKey = `interview:rt:${interviewId}`;
                await this.redisClient.hset(rtKey, {
                    stage: payload.currentStage || payload.stage || "",
                    status: payload.status || "",
                    canCandidateSpeak: String(Boolean(payload.canCandidateSpeak)),
                    turnCount: String(payload.turnCount ?? 0),
                    activePersonaId: payload.activePersonaId || payload.currentPersonaId || "",
                    selfIntroRetryCount: String(payload.selfIntroRetryCount ?? 0),
                    selfIntroStart: String(payload.selfIntroStart ?? 0),
                });
                await this.redisClient.expire(rtKey, 3600);
            }

            // VAD_START 이벤트 감지: 오디오 프로세서에게 녹화 시작을 알림
            if (payload.event === "VAD_START") {
                this.logger.debug(`[RedisSub] VAD_START detected for ${interviewId}`);
                void this.audioProcessorService.startRecording(interviewId);
                return;
            }

            void this.sendTranscriptUseCase.execute(
                new SendTranscriptCommand(this.interviewGateway.server, interviewId, payload),
            );
        } catch (error) {
            this.logger.error(
                `Transcript parsing error for msg: ${message.substring(0, 100)}... - ${error.message as string}`,
            );
        }
    }

    async onModuleDestroy() {
        if (this.subscriber) {
            await this.subscriber.quit();
        }
    }
}
