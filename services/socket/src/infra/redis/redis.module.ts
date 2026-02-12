import { Global, Module } from "@nestjs/common";
import { RedisClient, RedisStreamClient, RedisSubscriberClient } from "./redis.clients";
import { RedisHealthIndicator } from "./redis-health.indicator";
import { ConfigService } from "@nestjs/config";

@Global()
@Module({
    providers: [
        {
            provide: RedisClient,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) =>
                new RedisClient(RedisClient.createRedisOptions(configService)),
        },
        {
            provide: RedisStreamClient,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) =>
                new RedisStreamClient(RedisStreamClient.createRedisOptions(configService)),
        },
        {
            provide: RedisSubscriberClient,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) =>
                new RedisSubscriberClient(RedisSubscriberClient.createRedisOptions(configService)),
        },
        RedisHealthIndicator,
    ],
    exports: [RedisClient, RedisStreamClient, RedisSubscriberClient, RedisHealthIndicator],
})
export class RedisModule {}
