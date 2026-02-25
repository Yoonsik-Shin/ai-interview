import { Injectable, CanActivate } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * DevTool Guard
 *
 * 개발 환경에서만 DevTool API 접근을 허용합니다.
 * NODE_ENV가 'development'가 아닌 경우 403 Forbidden을 반환합니다.
 */
@Injectable()
export class DevToolGuard implements CanActivate {
    constructor(private configService: ConfigService) {}

    canActivate(): boolean {
        const nodeEnv = this.configService.get<string>("NODE_ENV");

        // 개발 환경에서만 허용
        if (nodeEnv !== "development") {
            return false;
        }

        return true;
    }
}
