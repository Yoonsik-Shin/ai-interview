import { Controller, Get, Version, VERSION_NEUTRAL } from "@nestjs/common";
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { RedisHealthIndicator } from "../../infrastructure/redis/redis-health.indicator";

@Controller("health")
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private memory: MemoryHealthIndicator,
        private redisHealth: RedisHealthIndicator,
    ) {}

    @Version(VERSION_NEUTRAL)
    @Get("liveness")
    @HealthCheck()
    checkLiveness() {
        return this.health.check([() => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024)]);
    }

    @Version(VERSION_NEUTRAL)
    @Get("readiness")
    @HealthCheck()
    checkReadiness() {
        return this.health.check([
            () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024),
            () => this.redisHealth.isHealthy("redis"),
        ]);
    }
}
