import { Injectable } from "@nestjs/common";
import { AuthGrpcService } from "src/infra/grpc/services/auth-grpc.service";

export class RefreshTokenCommand {
    constructor(public readonly refreshToken: string) {}
}

export class RefreshTokenResult {
    constructor(
        public readonly accessToken: string,
        public readonly refreshToken: string,
    ) {}
}

@Injectable()
export class RefreshTokenUseCase {
    constructor(private readonly authGrpcService: AuthGrpcService) {}

    /* Refresh Token으로 Access Token 재발급 */
    async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
        const response = await this.authGrpcService.refreshToken({
            refreshToken: command.refreshToken,
        });

        return new RefreshTokenResult(response.accessToken, response.refreshToken);
    }
}
