import { Injectable, OnModuleInit } from "@nestjs/common";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { RedisClient } from "../redis.clients";
import { AuthenticatedSocket } from "../../../types/socket.types";
import { AudioChunkDto } from "../../../modules/stt/dto/audio-chunk.dto";

@Injectable()
export class SttStorageService implements OnModuleInit {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly safeRedisClient: RedisClient,
    ) {}

    onModuleInit() {
        this.safeRedisClient.on("error", (err) => {
            this.logger.error(null, "redis_safe_path_error", {
                error: String(err),
            });
        });
    }

    async pushToRedis(
        client: AuthenticatedSocket,
        payload: AudioChunkDto,
        audioData: string | Buffer,
        metadata: any,
        timestamp: string,
    ) {
        try {
            const redisClient = this.safeRedisClient;
            const queueKey = `interview:audio:queue:${payload.interviewSessionId}`;

            const audioBase64 = Buffer.isBuffer(audioData)
                ? audioData.toString("base64")
                : audioData;

            const queueMessage = JSON.stringify({
                audioData: audioBase64,
                metadata: metadata,
                isFinal: payload.isFinal || false,
                timestamp,
            });

            await redisClient.rpush(queueKey, queueMessage);
            await redisClient.expire(queueKey, 7200);

            if (payload.isFinal) {
                this.logger.log(client, "audio_chunk_redis_success", {
                    interviewSessionId: payload.interviewSessionId,
                    queueKey,
                    isFinal: true,
                    path: "safe",
                });
            }
        } catch (error) {
            this.logger.error(client, "audio_chunk_redis_failed", {
                interviewSessionId: payload.interviewSessionId,
                error: String(error),
                path: "safe",
            });
        }
    }
}
