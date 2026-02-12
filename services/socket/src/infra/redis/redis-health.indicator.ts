import { Injectable } from "@nestjs/common";
import { HealthIndicatorResult } from "@nestjs/terminus";
import { RedisClient } from "./redis.clients";

@Injectable()
export class RedisHealthIndicator {
    constructor(private readonly redisClient: RedisClient) {}

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            const pong: "PONG" = await this.redisClient.ping();
            const isHealthy = pong === "PONG";
            const result: HealthIndicatorResult = {
                [key]: {
                    status: isHealthy ? "up" : "down",
                    message: pong,
                },
            };
            return result;
        } catch (error) {
            return {
                [key]: {
                    status: "down",
                    message: error.message,
                },
            };
        }
    }
}
