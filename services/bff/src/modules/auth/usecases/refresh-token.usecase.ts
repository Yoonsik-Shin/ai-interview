import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGrpcService } from "src/core/grpc-client/services/auth-grpc.service";

@Injectable()
export class RefreshTokenUseCase {
    constructor(private readonly authGrpcService: AuthGrpcService) {}

    /**
     * Refresh Token으로 Access Token 재발급
     */
    async execute(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const response = await this.authGrpcService.refreshToken({ refreshToken });
            return {
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
            };
        } catch {
            throw new UnauthorizedException("Invalid refresh token");
        }
    }
}
