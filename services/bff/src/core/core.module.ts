import { Module } from "@nestjs/common";
import { GrpcClientModule } from "./grpc-client/grpc-client.module";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";

@Module({
    imports: [
        HealthModule, //
        GrpcClientModule,
        RedisModule,
    ],
})
export class CoreModule {}
