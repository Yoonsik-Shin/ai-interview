import { INestApplicationContext, Logger } from "@nestjs/common";
import { Server, ServerOptions } from "socket.io";
import { RedisIoAdapter } from "../redis/redis-io.adapter";
import { AuthenticatedSocket } from "../../types/socket.types";
import { AuthService } from "../../modules/auth/auth.service";

export class AuthenticatedSocketAdapter extends RedisIoAdapter {
    protected readonly adapterLogger = new Logger(AuthenticatedSocketAdapter.name);
    private readonly authService: AuthService;

    constructor(private app: INestApplicationContext) {
        super(app);
        this.authService = this.app.get(AuthService);
    }

    createIOServer(port: number, options?: ServerOptions): Server {
        const server: Server = super.createIOServer(port, options);

        server.use((socket: AuthenticatedSocket, next) => {
            void this.authenticate(socket, next);
        });

        return server;
    }

    private async authenticate(socket: AuthenticatedSocket, next: (err?: Error) => void) {
        const token = this.extractTokenFromHandshake(socket);
        if (!token) {
            this.logger.warn(`Connection attempt without token from ${socket.id}`);
            return next(new Error("Authentication token missing"));
        }

        try {
            const { userId } = await this.authService.verifyToken(token);
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

    private extractTokenFromHandshake(socket: AuthenticatedSocket): string | undefined {
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
}
