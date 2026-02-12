import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import jwksRsa from "jwks-rsa";

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly jwksClient: jwksRsa.JwksClient;
    private readonly algorithm: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
    ) {
        this.jwksClient = jwksRsa({
            jwksUri: this.configService.getOrThrow<string>("JWT_JWKS_URI"),
            cache: true,
            rateLimit: true,
            cacheMaxAge: Number(this.configService.getOrThrow<number>("JWT_JWKS_CACHE_MAX_AGE_MS")),
            timeout: Number(this.configService.getOrThrow<number>("JWT_JWKS_TIMEOUT_MS")),
            jwksRequestsPerMinute: Number(
                this.configService.getOrThrow<number>("JWT_JWKS_REQUESTS_PER_MINUTE"),
            ),
        });

        this.algorithm = this.configService.getOrThrow<string>("JWT_ALGORITHM");
    }

    /* JWT 토큰 검증 및 유저 ID 추출 */
    async verifyToken(token: string): Promise<{ userId: string }> {
        try {
            // 1. 토큰 디코딩하여 헤더(kid) 추출
            const decoded = this.jwtService.decode(token, { complete: true });
            if (!decoded || typeof decoded === "string" || !decoded.header?.kid) {
                this.logger.warn(
                    `Invalid token format or missing kid: ${JSON.stringify(typeof decoded === "object" ? decoded?.header : decoded)}`,
                );
                throw new UnauthorizedException("Invalid token format");
            }

            const kid = decoded.header.kid;

            // 2. JWKS에서 공개키(Signing Key) 가져오기
            const key = await this.jwksClient.getSigningKey(kid);
            const publicKey = key.getPublicKey();

            // 3. 서명 검증
            const payload = await this.jwtService.verifyAsync(token, {
                publicKey,
                algorithms: [this.algorithm as any],
            });

            const userId = payload.userId || payload.sub;

            if (!userId) {
                throw new UnauthorizedException("Token payload missing userId or sub");
            }

            return { userId };
        } catch (error) {
            this.logger.error(`Token verification error: ${error.message}`);
            throw error;
        }
    }
}
