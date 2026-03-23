import { Controller, Get, Version, VERSION_NEUTRAL } from "@nestjs/common";
import {
    HealthCheck,
    HealthCheckService,
    MicroserviceHealthIndicator,
    MemoryHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private microservice: MicroserviceHealthIndicator,
        private memory: MemoryHealthIndicator,
    ) {}

    @Version(VERSION_NEUTRAL)
    @Get("liveness")
    checkLiveness() {
        return { status: "ok", timestamp: new Date().toISOString() };
    }

    @Version(VERSION_NEUTRAL)
    @HealthCheck()
    @Get("readiness")
    checkReadiness() {
        return this.health.check([
            // TODO: 메모리 체크 추가 필요
            // () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024),
            // TODO REDIS 헬스체크 추가 필요
            // () =>
            //     this.microservice.pingCheck("redis", {
            //         /* redis config */
            //     }),
            // TODO: 마이크로서비스 헬스체크 추가 필요
            // () =>
            //     this.microservice.pingCheck("grpc_auth", {
            //         /* grpc config */
            //     }),
        ]);
    }
}
