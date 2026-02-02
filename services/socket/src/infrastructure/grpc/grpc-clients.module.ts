import { Global, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from "path";

@Global()
@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: "STT_PACKAGE",
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: "stt",
                        protoPath: join(process.cwd(), "../proto/stt.proto"),
                        url: configService.getOrThrow<string>("STT_GRPC_URL"),
                    },
                }),
                inject: [ConfigService],
            },
            {
                name: "INTERVIEW_PACKAGE",
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        package: "interview",
                        protoPath: join(process.cwd(), "../proto/interview.proto"),
                        url: configService.getOrThrow<string>("CORE_GRPC_URL"),
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    exports: [ClientsModule],
})
export class GrpcClientsModule {}
