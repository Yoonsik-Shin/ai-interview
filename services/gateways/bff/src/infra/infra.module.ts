import { Global, Module } from "@nestjs/common";
import { GrpcModule } from "./grpc/grpc.module";
import { RedisModule } from "./redis/redis.module";

@Global()
@Module({
    imports: [GrpcModule, RedisModule],
    exports: [GrpcModule, RedisModule],
})
export class InfraModule {}
