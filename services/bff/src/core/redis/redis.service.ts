import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis, { RedisOptions } from "ioredis";

/**
 * Redis 서비스
 *
 * Redis 클라이언트를 싱글톤으로 관리합니다.
 * 애플리케이션 전체에서 하나의 Redis 연결을 공유합니다.
 * Redis Sentinel을 지원합니다.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly redis: Redis;

    constructor() {
        const options = this.createRedisOptions();
        this.redis = new Redis(options);

        this.redis.on("error", (err) => {
            console.error("Redis Client Error:", err);
        });

        this.redis.on("connect", () => {
            console.log("Redis Client Connected");
        });
    }

    private createRedisOptions(): RedisOptions {
        const sentinelHostsEnv = process.env.REDIS_SENTINEL_HOSTS;
        const sentinelHostEnv = process.env.REDIS_SENTINEL_HOST;
        const isSentinelAvailable = Boolean(sentinelHostsEnv || sentinelHostEnv);

        if (!isSentinelAvailable) {
            return {
                host: process.env.REDIS_HOST || "redis",
                port: parseInt(process.env.REDIS_PORT || "6379"),
                password: process.env.REDIS_PASSWORD,
            };
        }

        const sentinelPort = parseInt(process.env.REDIS_SENTINEL_PORT || "26379");
        const sentinelName = process.env.REDIS_SENTINEL_NAME || "mymaster";
        const password = process.env.REDIS_PASSWORD;

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

    /**
     * Redis 클라이언트 인스턴스 반환
     */
    getClient(): Redis {
        return this.redis;
    }

    /**
     * 애플리케이션 종료 시 Redis 연결 종료
     */
    onModuleDestroy() {
        this.redis.quit();
    }
}
