import { IoAdapter } from "@nestjs/platform-socket.io";
import { Server, ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Logger } from "@nestjs/common";

export class RedisIoAdapter extends IoAdapter {
    protected readonly logger = new Logger(RedisIoAdapter.name);
    private adapterConstructor: any;

    connectToRedis(pubClient: any, subClient: any): void {
        this.adapterConstructor = createAdapter(pubClient, subClient);
        this.logger.log("Socket.io Redis Adapter Connected!");
    }

    createIOServer(port: number, options?: ServerOptions): Server {
        // WebSocket 연결 안정성을 위한 명시적 옵션 설정
        const serverOptions = this.mergeServerOptions(options);
        const server = super.createIOServer(port, serverOptions as ServerOptions) as Server;

        server.adapter(this.adapterConstructor);

        return server;
    }

    private mergeServerOptions(options?: ServerOptions): Partial<ServerOptions> {
        const defaultPingTimeout = 60000;
        const defaultPingInterval = 25000;
        const defaultUpgradeTimeout = 10000;

        const pingTimeout =
            options?.pingTimeout && options.pingTimeout > 0
                ? options.pingTimeout
                : defaultPingTimeout;

        const pingInterval =
            options?.pingInterval && options.pingInterval > 0 && options.pingInterval < pingTimeout
                ? options.pingInterval
                : defaultPingInterval;

        const upgradeTimeout =
            options?.upgradeTimeout && options.upgradeTimeout > 0
                ? options.upgradeTimeout
                : defaultUpgradeTimeout;

        return {
            ...options,
            transports: ["websocket", "polling"],
            allowEIO3: true,
            pingTimeout,
            pingInterval,
            upgradeTimeout,
            maxHttpBufferSize: 1e6,
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true,
            },
        };
    }
}
