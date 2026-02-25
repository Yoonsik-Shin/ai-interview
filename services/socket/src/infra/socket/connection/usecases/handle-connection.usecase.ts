import { Injectable } from "@nestjs/common";
import { Socket } from "socket.io";
import { randomUUID } from "crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../../../core/logging/socket-logging.service";

export class HandleConnectionCommand {
    constructor(public readonly client: Socket) {}
}

@Injectable()
export class HandleConnectionUseCase {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async execute(command: HandleConnectionCommand): Promise<void> {
        const { client } = command;

        if (!client.data.userId) {
            this.logger.log(client, "no_authenticated_user_disconnecting");
            client.disconnect(true);
            return;
        }

        client.data.traceId = client.handshake.auth?.traceId || randomUUID();
        client.data.query = client.handshake.query;

        this.logger.log(client, "session_established", { userId: client.data.userId });

        // 이벤트 발행: 도메인 모듈들이 알아서 정리
        this.eventEmitter.emit("socket.connected", { client });
    }
}
