import { Global, Module } from "@nestjs/common";
import { ClientsModule } from "@nestjs/microservices";
import { GrpcConfigService } from "./services/grpc-config.service";

@Global()
@Module({
    providers: [GrpcConfigService],
    exports: [GrpcConfigService, ClientsModule],
    imports: [
        ClientsModule.registerAsync([
            {
                name: "STT_PACKAGE",
                useFactory: (grpcConfig: GrpcConfigService) => grpcConfig.getGrpcOptions("stt.v1"),
                inject: [GrpcConfigService],
            },
            {
                name: "INTERVIEW_PACKAGE",
                useFactory: (grpcConfig: GrpcConfigService) =>
                    grpcConfig.getGrpcOptions("interview.v1"),
                inject: [GrpcConfigService],
            },
        ]),
    ],
})
export class GrpcClientsModule {}
