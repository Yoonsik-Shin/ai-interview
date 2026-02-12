import { Injectable } from "@nestjs/common";
import { Socket } from "socket.io";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../../../core/logging/socket-logging.service";

export class HandleDisconnectCommand {
    constructor(public readonly client: Socket) {}
}

@Injectable()
export class HandleDisconnectUseCase {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async execute(command: HandleDisconnectCommand): Promise<void> {
        const { client } = command;
        this.logger.log(client, "connection_disconnected");

        // 이벤트 발행: 도메인 모듈들이 알아서 정리
        this.eventEmitter.emit("socket.disconnected", {
            client,
        });
    }
}
