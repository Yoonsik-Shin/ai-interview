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
                useFactory: (configService: ConfigService) => {
                    const host = configService.getOrThrow<string>("STT_GRPC_HOST");
                    const port = configService.getOrThrow<number>("STT_GRPC_PORT");
                    return {
                        transport: Transport.GRPC,
                        options: {
                            package: "stt.v1",
                            protoPath: join(process.cwd(), "../proto/stt/v1/stt.proto"),
                            url: `${host}:${port}`,
                        },
                    };
                },
                inject: [ConfigService],
            },
            {
                name: "INTERVIEW_PACKAGE",
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => {
                    const host = configService.getOrThrow<string>("CORE_GRPC_HOST");
                    const port = configService.getOrThrow<number>("CORE_GRPC_PORT");
                    return {
                        transport: Transport.GRPC,
                        options: {
                            package: "interview.v1",
                            protoPath: join(process.cwd(), "../proto/interview/v1/interview.proto"),
                            url: `${host}:${port}`,
                        },
                    };
                },
                inject: [ConfigService],
            },
        ]),
    ],
    exports: [ClientsModule],
})
export class GrpcClientsModule {}
