import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import jwksRsa from "jwks-rsa";

import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
    sub: string;
    role: string;
    typ?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService) {
        const cacheMaxAgeMs = configService.get<number>("JWT_JWKS_CACHE_MAX_AGE_MS", 5 * 60 * 1000);
        const jwksRequestsPerMinute = configService.get<number>("JWT_JWKS_REQUESTS_PER_MINUTE", 10);
        const timeoutMs = configService.get<number>("JWT_JWKS_TIMEOUT_MS", 30 * 1000);

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: jwksRsa.passportJwtSecret({
                cache: true,
                cacheMaxAge: cacheMaxAgeMs,
                rateLimit: true,
                jwksRequestsPerMinute,
                timeout: timeoutMs,
                jwksUri: configService.getOrThrow<string>("JWT_JWKS_URI"),
            }),
            algorithms: ["RS256"],
        });
    }

    validate(payload: JwtPayload): { userId: string; role: string } {
        if (!payload.sub || !payload.role) {
            throw new UnauthorizedException("Invalid token payload");
        }
        if (payload.typ && payload.typ !== "access") {
            throw new UnauthorizedException("Invalid token type");
        }

        return {
            userId: payload.sub,
            role: payload.role,
        };
    }
}
