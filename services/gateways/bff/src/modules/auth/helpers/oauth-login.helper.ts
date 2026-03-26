import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { GoogleOAuthUser } from "../strategies/google.strategy";
import { LoginWithOAuthUseCase } from "../usecases/login-with-oauth.usecase";

@Injectable()
export class OAuthLoginHelper {
    constructor(
        private readonly loginWithOAuthUseCase: LoginWithOAuthUseCase,
        private readonly configService: ConfigService,
    ) {}

    async handleOAuthCallback(oauthUser: GoogleOAuthUser, res: Response): Promise<void> {
        const frontendUrl = this.configService.getOrThrow<string>("FRONTEND_URL");
        const result = await this.loginWithOAuthUseCase.execute(oauthUser);

        if (result.isNewUser) {
            // 신규 유저: pending_token과 함께 /complete-profile로 리다이렉트
            const params = new URLSearchParams({ pending_token: result.pendingToken! });
            res.redirect(`${frontendUrl}/complete-profile?${params.toString()}`);
        } else {
            // 기존 유저: refreshToken 쿠키 설정 후 accessToken을 쿼리 파라미터로 전달
            res.cookie("refreshToken", result.auth!.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            const params = new URLSearchParams({ access_token: result.auth!.accessToken });
            res.redirect(`${frontendUrl}?${params.toString()}`);
        }
    }
}
