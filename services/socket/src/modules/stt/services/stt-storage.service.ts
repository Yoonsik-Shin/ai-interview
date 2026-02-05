import { Injectable, OnModuleInit } from "@nestjs/common";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { RedisClient } from "../../../infrastructure/redis/redis.clients";
import { Socket } from "socket.io";

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
        client: Socket,
        payload: any,
        audioData: string | Buffer, // Accept Buffer as well
        metadata: any,
        timestamp: string,
    ) {
        try {
            const redisClient = this.safeRedisClient;
            const queueKey = `interview:audio:queue:${payload.interviewSessionId}`;

            // Convert Buffer to Base64 if needed for JSON compatibility
            const audioBase64 = Buffer.isBuffer(audioData)
                ? audioData.toString("base64")
                : audioData;

            const queueMessage = JSON.stringify({
                audioData: audioBase64,
                metadata: metadata,
                isFinal: payload.isFinal || false,
                timestamp,
            });

            // Push JSON string directly
            await redisClient.rpush(queueKey, queueMessage);

            // Set TTL to 2 hours (7200s) to prevent memory leaks from abandoned sessions
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
