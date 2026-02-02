import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { RedisStreamClient } from "../../../infrastructure/redis/redis.clients";
import { SttTranscriptPayload } from "../dto/stt-transcript.dto";

@Injectable()
export class SttStreamConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly sttRedisStream: string;
    private readonly sttRedisGroup: string;
    private readonly sttRedisConsumer: string;
    private readonly isEnabled: boolean;
    private loopRunning = false;
    private stopSignal = false;

    constructor(
        private readonly logger: SocketLoggingService,
        private readonly redisClient: RedisStreamClient,
        private readonly eventEmitter: EventEmitter2,
    ) {
        const source = (process.env.STT_RESPONSE_SOURCE || "pubsub").toLowerCase();
        this.isEnabled = source === "stream" || source === "both";

        this.sttRedisStream = process.env.STT_REDIS_STREAM || "stt:transcript:stream";
        this.sttRedisGroup = process.env.STT_REDIS_GROUP || "stt:transcript:group";
        this.sttRedisConsumer =
            process.env.STT_REDIS_CONSUMER ||
            `stt:transcript:consumer:${process.pid}-${Date.now()}`;
    }

    onModuleInit() {
        if (!this.isEnabled) {
            return;
        }

        this.startConsumer().catch((error) => {
            this.logger.log(null, "redis_stt_stream_start_failed", {
                error: String(error),
            });
        });
    }

    onModuleDestroy() {
        this.stopSignal = true;
    }

    private async startConsumer(): Promise<void> {
        if (this.loopRunning) return;
        this.loopRunning = true;

        this.redisClient.on("error", (err) => {
            this.logger.log(null, "redis_stt_stream_error", {
                error: String(err),
            });
        });

        try {
            await this.redisClient.xgroup(
                "CREATE",
                this.sttRedisStream,
                this.sttRedisGroup,
                "$",
                "MKSTREAM",
            );
        } catch (error) {
            const message = String(error);
            if (!message.includes("BUSYGROUP")) {
                this.logger.log(null, "redis_stt_stream_group_create_failed", {
                    error: message,
                });
            }
        }

        this.logger.log(null, "redis_stt_stream_consumer_started", {
            stream: this.sttRedisStream,
            group: this.sttRedisGroup,
            consumer: this.sttRedisConsumer,
        });

        this.runLoop().catch((error) => {
            this.logger.log(null, "redis_stt_stream_loop_failed", {
                error: String(error),
            });
        });
    }

    private async runLoop(): Promise<void> {
        while (!this.stopSignal) {
            try {
                const result = await (this.redisClient as any).xreadgroup(
                    "GROUP",
                    this.sttRedisGroup,
                    this.sttRedisConsumer,
                    "BLOCK",
                    5000,
                    "COUNT",
                    10,
                    "STREAMS",
                    this.sttRedisStream,
                    ">",
                );

                if (!result) continue;

                for (const [, entries] of result) {
                    for (const entry of entries) {
                        const entryId = entry[0];
                        const fields = entry[1] as string[];
                        const payload = this.parsePayload(fields);

                        if (payload) {
                            this.eventEmitter.emit("stt.transcript.received", {
                                data: payload,
                                source: "stream",
                            });
                        }

                        await this.redisClient.xack(
                            this.sttRedisStream,
                            this.sttRedisGroup,
                            entryId,
                        );
                    }
                }
            } catch (error) {
                this.logger.log(null, "redis_stt_stream_read_failed", {
                    error: String(error),
                });
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }

    private parsePayload(fields: string[]): SttTranscriptPayload | null {
        if (!fields || fields.length === 0) return null;

        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
            const key = fields[i];
            const value = fields[i + 1];
            if (key !== undefined && value !== undefined) {
                data[String(key)] = String(value);
            }
        }

        if (!data.payload) return null;

        try {
            return JSON.parse(data.payload) as SttTranscriptPayload;
        } catch (error) {
            this.logger.log(null, "stt_stream_payload_parse_error", {
                error: String(error),
            });
            return null;
        }
    }
}
