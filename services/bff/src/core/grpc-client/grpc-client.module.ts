import { Global, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { join } from "node:path";
import { AuthGrpcService } from "./services/auth-grpc.service";
import { UserGrpcService } from "./services/user-grpc.service";

// TODO: grpc url 환경변수 분리 필요
@Global()
@Module({
    imports: [
        ClientsModule.register([
            {
                name: "AUTH_PACKAGE",
                transport: Transport.GRPC,
                options: {
                    package: "auth",
                    protoPath: join(process.cwd(), "proto/auth.proto"),
                    url:
                        process.env.CORE_GRPC_URL ||
                        (process.env.CORE_GRPC_HOST && process.env.CORE_GRPC_PORT
                            ? `${process.env.CORE_GRPC_HOST}:${process.env.CORE_GRPC_PORT}`
                            : "core:9090"),
                    loader: {
                        keepCase: false,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true,
                    },
                },
            },
            {
                name: "INTERVIEW_PACKAGE",
                transport: Transport.GRPC,
                options: {
                    package: "interview",
                    protoPath: join(process.cwd(), "proto/interview.proto"),
                    url:
                        process.env.CORE_GRPC_URL ||
                        (process.env.CORE_GRPC_HOST && process.env.CORE_GRPC_PORT
                            ? `${process.env.CORE_GRPC_HOST}:${process.env.CORE_GRPC_PORT}`
                            : "core:9090"),
                    loader: {
                        keepCase: false,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true,
                    },
                },
            },
            {
                name: "LLM_PACKAGE",
                transport: Transport.GRPC,
                options: {
                    package: "llm",
                    protoPath: join(process.cwd(), "proto/llm.proto"),
                    url: process.env.LLM_GRPC_URL || process.env.INFERENCE_GRPC_URL || "llm:50051",
                    loader: {
                        keepCase: false,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true,
                    },
                },
            },
            {
                name: "USER_PACKAGE",
                transport: Transport.GRPC,
                options: {
                    package: "user",
                    protoPath: join(process.cwd(), "proto/user.proto"),
                    url:
                        process.env.CORE_GRPC_URL ||
                        (process.env.CORE_GRPC_HOST && process.env.CORE_GRPC_PORT
                            ? `${process.env.CORE_GRPC_HOST}:${process.env.CORE_GRPC_PORT}`
                            : "core:9090"),
                    loader: {
                        keepCase: false,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true,
                    },
                },
            },
        ]),
    ],
    providers: [AuthGrpcService, UserGrpcService],
    exports: [ClientsModule, AuthGrpcService, UserGrpcService],
})
export class GrpcClientModule {}
