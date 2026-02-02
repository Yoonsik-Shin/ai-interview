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
        audioBase64: string,
        metadata: any,
        timestamp: string,
    ) {
        try {
            const redisClient = this.safeRedisClient;
            const queueKey = `interview:audio:queue:${payload.interviewSessionId}`;
            const queueMessage = JSON.stringify({
                audioData: audioBase64,
                metadata: metadata,
                isFinal: payload.isFinal || false,
                timestamp,
            });

            await redisClient.rpush(queueKey, queueMessage);

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
