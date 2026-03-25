import Redis, { type RedisOptions } from "ioredis";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export abstract class BaseRedisClient extends Redis implements OnModuleDestroy {
    constructor(options: RedisOptions) {
        super(options);
    }

    async onModuleDestroy(): Promise<void> {
        try {
            await this.quit();
        } catch {
            this.disconnect();
        }
    }

    static createRedisOptions(configService: ConfigService): RedisOptions {
        const redisPassword = configService.getOrThrow<string>("REDIS_PASSWORD");
        const redisDb = configService.getOrThrow<number>("REDIS_DB");

        const sentinelHostsEnv = configService.get<string>("REDIS_SENTINEL_HOSTS");
        const sentinelHostEnv = configService.get<string>("REDIS_SENTINEL_HOST");
        const isSentinelAvailable = Boolean(sentinelHostsEnv || sentinelHostEnv);

        if (!isSentinelAvailable) {
            return {
                host: configService.getOrThrow<string>("REDIS_HOST"),
                port: configService.getOrThrow<number>("REDIS_PORT"),
                db: redisDb,
                password: redisPassword,
            };
        }

        const sentinelPort = configService.getOrThrow<number>("REDIS_SENTINEL_PORT");
        const sentinelName = configService.getOrThrow<string>("REDIS_SENTINEL_NAME");
        const endpoints = sentinelHostsEnv
            ? this.parseSentinelEndpoints(sentinelHostsEnv, sentinelPort)
            : [{ host: sentinelHostEnv!, port: sentinelPort }];

        return {
            name: sentinelName,
            password: redisPassword || undefined,
            db: redisDb,
            sentinelPassword: redisPassword || undefined,
            sentinels: endpoints,
        };
    }

    private static parseSentinelEndpoints(
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
}

@Injectable()
export class RedisClient extends BaseRedisClient {
    constructor(options: RedisOptions) {
        super(options);
    }
}

@Injectable()
export class RedisStreamClient extends BaseRedisClient {
    constructor(options: RedisOptions) {
        super(options);
    }
}

@Injectable()
export class RedisSubscriberClient extends BaseRedisClient {
    constructor(options: RedisOptions) {
        super(options);
    }
}
