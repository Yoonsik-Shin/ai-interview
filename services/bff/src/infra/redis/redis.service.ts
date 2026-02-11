import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis, { RedisOptions } from "ioredis";

/**
 * 애플리케이션 전체에서 하나의 Redis 연결을 공유합니다.
 * Redis Sentinel을 지원합니다.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly redis: Redis;
    private readonly logger = new Logger(RedisService.name);

    constructor(private readonly configService: ConfigService) {
        this.redis = new Redis(this.createRedisOptions());
        this.redis.on("error", (err) => {
            this.logger.error("Redis Client Error:", err);
        });
    }

    private createRedisOptions(): RedisOptions {
        const sentinelHostsEnv = this.configService.get<string>("REDIS_SENTINEL_HOSTS");
        const sentinelHostEnv = this.configService.get<string>("REDIS_SENTINEL_HOST");
        const isSentinelAvailable = Boolean(sentinelHostsEnv || sentinelHostEnv);

        if (!isSentinelAvailable) {
            return {
                host: this.configService.getOrThrow<string>("REDIS_HOST"),
                port: this.configService.getOrThrow<number>("REDIS_PORT"),
                password: this.configService.get<string>("REDIS_PASSWORD"),
            };
        }

        const sentinelPort = this.configService.getOrThrow<number>("REDIS_SENTINEL_PORT");
        const sentinelName = this.configService.getOrThrow<string>("REDIS_SENTINEL_NAME");
        const password = this.configService.get<string>("REDIS_PASSWORD");

        const endpoints = sentinelHostsEnv
            ? this.parseSentinelEndpoints(sentinelHostsEnv, sentinelPort)
            : [{ host: sentinelHostEnv!, port: sentinelPort }];

        return {
            name: sentinelName,
            password: password,
            sentinelPassword: password,
            sentinels: endpoints,
        };
    }

    private parseSentinelEndpoints(
        hostsEnv: string,
        defaultPort: number,
    ): { host: string; port: number }[] {
        const endpoints = hostsEnv
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
                const [host, portStr] = entry.split(":");
                return { host, port: parseInt(portStr || String(defaultPort), 10) };
            });

        if (endpoints.length === 0) {
            throw new Error("REDIS_SENTINEL_HOSTS is not set or invalid");
        }
        return endpoints;
    }

    getClient(): Redis {
        return this.redis;
    }

    async onModuleDestroy() {
        await this.redis.quit();
    }
}
