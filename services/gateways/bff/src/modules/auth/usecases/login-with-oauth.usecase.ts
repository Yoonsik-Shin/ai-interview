import { Injectable } from "@nestjs/common";
import { AuthGrpcService } from "src/infra/grpc/services/auth-grpc.service";
import { GoogleOAuthUser } from "../strategies/google.strategy";

export class LoginWithOAuthResult {
    constructor(
        public readonly isNewUser: boolean,
        public readonly pendingToken: string | undefined,
        public readonly auth:
            | {
                  accessToken: string;
                  refreshToken: string;
                  user: { id: string; email: string; nickname: string; role: string };
              }
            | undefined,
    ) {}
}

@Injectable()
export class LoginWithOAuthUseCase {
    constructor(private readonly authGrpcService: AuthGrpcService) {}

    async execute(oauthUser: GoogleOAuthUser): Promise<LoginWithOAuthResult> {
        const response = await this.authGrpcService.loginWithOAuth({
            provider: oauthUser.provider,
            providerUserId: oauthUser.providerUserId,
            accessToken: oauthUser.accessToken,
            tokenExpiresAt: oauthUser.tokenExpiresAt,
            email: oauthUser.email,
            name: oauthUser.name,
            pictureUrl: oauthUser.pictureUrl,
        });

        return new LoginWithOAuthResult(
            response.isNewUser,
            response.pendingToken || undefined,
            response.auth
                ? {
                      accessToken: response.auth.accessToken,
                      refreshToken: response.auth.refreshToken,
                      user: response.auth.user!,
                  }
                : undefined,
        );
    }
}
