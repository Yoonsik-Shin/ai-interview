import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Transport, ClientOptions } from "@nestjs/microservices";
import { join } from "node:path";

@Injectable()
export class GrpcConfigService {
    private readonly logger = new Logger(GrpcConfigService.name);

    constructor(private readonly configService: ConfigService) {}

    getGrpcOptions(packageName: string): ClientOptions {
        const [domain, version] = packageName.split(".");
        const protoPath = version
            ? join(process.cwd(), `../proto/${domain}/${version}/${domain}.proto`)
            : join(process.cwd(), `../proto/${domain}.proto`);

        return {
            transport: Transport.GRPC,
            options: {
                package: packageName,
                protoPath,
                url: this.getGrpcUrl(domain),
                loader: {
                    keepCase: false,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                    includeDirs: [join(process.cwd(), "../proto")],
                },
                // Socket 서비스 전용: STT 등 실시간 스트리밍을 위한 Keep-Alive 설정
                keepalive: {
                    keepaliveTimeMs: 10000,
                    keepaliveTimeoutMs: 5000,
                    keepalivePermitWithoutCalls: 1,
                },
            },
        };
    }

    private getGrpcUrl(packageName: string): string {
        const prefix = packageName.toUpperCase();

        try {
            const host = this.configService.getOrThrow<string>(`${prefix}_GRPC_HOST`);
            const port = this.configService.getOrThrow<number>(`${prefix}_GRPC_PORT`);
            return `${host}:${port}`;
        } catch {
            // Core 서버 fallback
            const coreHost = this.configService.getOrThrow<string>("CORE_GRPC_HOST");
            const corePort = this.configService.getOrThrow<number>("CORE_GRPC_PORT");
            this.logger.warn(`Specific config for ${packageName} not found, falling back to CORE`);
            return `${coreHost}:${corePort}`;
        }
    }
}
