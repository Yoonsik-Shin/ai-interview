import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import { Socket } from "socket.io";
import {
    HandleConnectionUseCase,
    HandleConnectionCommand,
} from "./usecases/handle-connection.usecase";
import {
    HandleDisconnectUseCase,
    HandleDisconnectCommand,
} from "./usecases/handle-disconnect.usecase";

@WebSocketGateway({ cors: { origin: "*" } })
export class ConnectionGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private readonly handleConnectionUseCase: HandleConnectionUseCase,
        private readonly handleDisconnectUseCase: HandleDisconnectUseCase,
    ) {}

    // 클라이언트 연결 처리
    handleConnection(client: Socket) {
        void this.handleConnectionUseCase.execute(new HandleConnectionCommand(client));
    }

    // 클라이언트 연결 해제 처리
    handleDisconnect(client: Socket) {
        void this.handleDisconnectUseCase.execute(new HandleDisconnectCommand(client));
    }
}
