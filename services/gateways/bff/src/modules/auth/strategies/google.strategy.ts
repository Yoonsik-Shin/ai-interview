import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

export interface GoogleOAuthUser {
    provider: "GOOGLE";
    providerUserId: string;
    accessToken: string;
    tokenExpiresAt: number; // Unix timestamp (seconds)
    email: string;
    name: string;
    pictureUrl: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
    constructor(configService: ConfigService) {
        super({
            clientID: configService.getOrThrow<string>("GOOGLE_CLIENT_ID"),
            clientSecret: configService.getOrThrow<string>("GOOGLE_CLIENT_SECRET"),
            callbackURL: configService.getOrThrow<string>("GOOGLE_CALLBACK_URL"),
            scope: ["email", "profile"],
        });
    }

    validate(
        accessToken: string,
        _refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): void {
        const tokenExpiresAt = Math.floor(Date.now() / 1000) + 3600;

        const user: GoogleOAuthUser = {
            provider: "GOOGLE",
            providerUserId: profile.id,
            accessToken,
            tokenExpiresAt,
            email: profile.emails?.[0]?.value ?? "",
            name: profile.displayName ?? "",
            pictureUrl: profile.photos?.[0]?.value ?? "",
        };
        done(null, user);
    }
}
