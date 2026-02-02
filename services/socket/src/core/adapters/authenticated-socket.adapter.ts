import { INestApplicationContext, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Server, ServerOptions, Socket } from "socket.io";
import jwksRsa from "jwks-rsa";
import { RedisIoAdapter } from "../../infrastructure/redis/redis-io.adapter";

export class AuthenticatedSocketAdapter extends RedisIoAdapter {
    private readonly logger = new Logger(AuthenticatedSocketAdapter.name);
    private readonly jwtService: JwtService;
    private readonly jwksClient: jwksRsa.JwksClient;

    constructor(private app: INestApplicationContext) {
        super(app);
        const configService = this.app.get(ConfigService);
        this.jwtService = this.app.get(JwtService);

        this.jwksClient = jwksRsa({
            // 중요: Socket 서비스는 Core 서비스(.well-known/jwks.json 제공자)와 통신 가능해야 함
            jwksUri:
                configService.get<string>("JWT_JWKS_URI") ||
                "http://core:8081/.well-known/jwks.json",
            cache: true,
            rateLimit: true,
            cacheMaxAge: Number(configService.getOrThrow<number>("JWT_JWKS_CACHE_MAX_AGE_MS")),
            timeout: Number(configService.getOrThrow<number>("JWT_JWKS_TIMEOUT_MS")),
            jwksRequestsPerMinute: Number(
                configService.getOrThrow<number>("JWT_JWKS_REQUESTS_PER_MINUTE"),
            ),
        });
    }

    createIOServer(port: number, options?: ServerOptions): Server {
        const server: Server = super.createIOServer(port, options);

        // 미들웨어 등록
        server.use((socket: Socket, next) => {
            void this.authenticate(socket, next);
        });

        return server;
    }

    private async authenticate(socket: Socket, next: (err?: Error) => void) {
        const token = this.extractTokenFromHandshake(socket);
        if (!token) {
            this.logger.warn(`Connection attempt without token from ${socket.id}`);
            return next(new Error("Authentication token missing"));
        }

        try {
            const { userId } = await this.verifyToken(token);
            this.logger.log(`Socket authentication successful for ${socket.id}, userId: ${userId}`);
            socket.data.userId = userId;
            next();
        } catch (err) {
            this.logger.error(
                `Socket authentication failed for ${socket.id}: ${err.message}`,
                err.stack,
            );
            next(new Error("Authentication failed"));
        }
    }

    private extractTokenFromHandshake(socket: Socket): string | undefined {
        const auth = socket.handshake.auth;
        if (auth && auth.token) {
            const token = String(auth.token);
            const parts = token.split(" ");
            if (parts.length === 2 && parts[0] === "Bearer") {
                return parts[1];
            }
            return token;
        }

        const headers = socket.handshake.headers;
        if (headers && headers.authorization) {
            const authHeader = String(headers.authorization);
            const parts = authHeader.split(" ");
            if (parts.length === 2 && parts[0] === "Bearer") {
                return parts[1];
            }
            return authHeader;
        }

        return undefined;
    }

    private async verifyToken(token: string): Promise<{ userId: string }> {
        try {
            // 1. 토큰 디코딩하여 헤더(kid) 추출
            const decoded = this.jwtService.decode(token, { complete: true });
            if (!decoded || !decoded.header || !decoded.header.kid) {
                this.logger.warn(
                    `Invalid token format or missing kid: ${JSON.stringify(decoded?.header)}`,
                );
                throw new UnauthorizedException("Invalid token format");
            }

            // 2. JWKS에서 공개키(Signing Key) 가져오기
            const kid = decoded.header.kid;
            this.logger.debug(`Verifying token with kid: ${kid}`);

            const key = await this.jwksClient.getSigningKey(kid);
            const publicKey = key.getPublicKey();

            // 3. 서명 검증
            const payload = await this.jwtService.verifyAsync(token, {
                publicKey,
                algorithms: ["RS256"],
            });

            this.logger.debug(`Token payload: ${JSON.stringify(payload)}`);
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
