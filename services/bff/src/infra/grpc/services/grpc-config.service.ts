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
            ? join(process.cwd(), `proto/${domain}/${version}/${domain}.proto`)
            : join(process.cwd(), `proto/${domain}.proto`);

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
                    includeDirs: [join(process.cwd(), "proto")],
                },
            },
        };
    }

    private getGrpcUrl(packageName: string): string {
        const domain = packageName.split(".")[0];
        const prefix = domain.toUpperCase();

        try {
            const host = this.configService.getOrThrow<string>(`${prefix}_GRPC_HOST`);
            const port = this.configService.getOrThrow<number>(`${prefix}_GRPC_PORT`);
            return `${host}:${port}`;
        } catch {
            /**
             * 핵심 서비스들은 Core 서버에서 모놀리식으로 관리되고 있으므로 fallback 처리
             * // TODO: 추후, 각 서비스별로 서버가 분리되면 이 부분은 제거될 예정
             */
            const coreHost = this.configService.getOrThrow<string>("CORE_GRPC_HOST");
            const corePort = this.configService.getOrThrow<number>("CORE_GRPC_PORT");
            this.logger.warn(`Specific config for ${packageName} not found, falling back to CORE`);
            return `${coreHost}:${corePort}`;
        }
    }
}
