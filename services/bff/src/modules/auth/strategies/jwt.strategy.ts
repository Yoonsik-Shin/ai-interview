import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import jwksRsa from "jwks-rsa";

function parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

export interface JwtPayload {
    sub: string;
    role: string;
    typ?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const cacheMaxAgeMs = parsePositiveInt(
            process.env.JWT_JWKS_CACHE_MAX_AGE_MS,
            5 * 60 * 1000,
        );
        const jwksRequestsPerMinute = parsePositiveInt(
            process.env.JWT_JWKS_REQUESTS_PER_MINUTE,
            10,
        );
        const timeoutMs = parsePositiveInt(process.env.JWT_JWKS_TIMEOUT_MS, 30 * 1000);

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: jwksRsa.passportJwtSecret({
                cache: true,
                cacheMaxAge: cacheMaxAgeMs,
                rateLimit: true,
                jwksRequestsPerMinute,
                timeout: timeoutMs,
                jwksUri: process.env.JWT_JWKS_URI || "http://core:8081/.well-known/jwks.json",
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
