import { Injectable, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { RedisSubscriberClient } from "../../../infrastructure/redis/redis.clients";
import { SttTranscriptPayload } from "../dto/stt-transcript.dto";

@Injectable()
export class SttPubSubConsumer implements OnModuleInit {
    private readonly sttRedisChannel: string;
    private readonly isEnabled: boolean;

    constructor(
        private readonly logger: SocketLoggingService,
        private readonly redisSubscriber: RedisSubscriberClient,
        private readonly eventEmitter: EventEmitter2,
    ) {
        const source = (process.env.STT_RESPONSE_SOURCE || "pubsub").toLowerCase();
        this.isEnabled = source === "pubsub" || source === "both";
        this.sttRedisChannel = process.env.STT_REDIS_CHANNEL || "stt:transcript:pubsub";
    }

    onModuleInit() {
        if (!this.isEnabled) {
            return;
        }

        this.redisSubscriber.on("error", (err) => {
            this.logger.error(null, "redis_stt_pubsub_error", {
                error: String(err),
            });
        });

        this.redisSubscriber
            .subscribe(this.sttRedisChannel, (err, count) => {
                if (err) {
                    this.logger.error(null, "redis_stt_subscribe_error", {
                        error: String(err),
                    });
                } else {
                    this.logger.log(null, "redis_stt_subscribed", {
                        channel: this.sttRedisChannel,
                        count,
                    });
                }
            })
            .catch((error) => {
                this.logger.error(null, "redis_stt_subscribe_failed", {
                    error: String(error),
                });
            });

        this.redisSubscriber.on("message", (channel: string, message: string) => {
            if (channel === this.sttRedisChannel) {
                this.handleMessage(message);
            }
        });
    }

    private handleMessage(message: string): void {
        try {
            const data = JSON.parse(message) as SttTranscriptPayload;
            this.eventEmitter.emit("stt.transcript.received", { data, source: "pubsub" });
        } catch (err) {
            this.logger.error(null, "stt_redis_message_parse_error", {
                error: String(err),
            });
        }
    }
}
