import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { randomUUID } from "crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../core/logging/socket-logging.service";

@WebSocketGateway({ cors: { origin: "*" } })
export class ConnectionGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    // 클라이언트 연결 처리
    handleConnection(client: Socket) {
        // AuthenticatedSocketAdapter에서 이미 JWT 검증 완료
        if (!client.data.userId) {
            this.logger.log(client, "no_authenticated_user_disconnecting");
            client.disconnect(true);
            return;
        }

        // auth 객체에 traceId를 담아 보내면 그 값을 사용하고 그렇지 않으면 randomUUID()를 사용하여 생성
        client.data.traceId = client.handshake.auth?.traceId || randomUUID();

        // query 객체에 type을 담아 보내면 그 값을 사용
        client.data.query = client.handshake.query;

        this.logger.log(client, "session_established", { userId: client.data.userId });

        // 이벤트 발행: 도메인 모듈들이 알아서 정리
        this.eventEmitter.emit("socket.connected", { client });
    }

    // 클라이언트 연결 해제 처리
    handleDisconnect(client: Socket) {
        this.logger.log(client, "connection_disconnected");

        // 이벤트 발행: 도메인 모듈들이 알아서 정리
        this.eventEmitter.emit("socket.disconnected", {
            client,
        });
    }
}
