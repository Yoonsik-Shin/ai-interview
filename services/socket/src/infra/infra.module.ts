import { Module } from "@nestjs/common";
import { RedisModule } from "./redis/redis.module";
import { GrpcClientsModule } from "./grpc/grpc-clients.module";

@Module({
    imports: [GrpcClientsModule, RedisModule],
})
export class InfraModule {}
