import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service.js";
import type {
    SocketConnectedEvent,
    SocketDisconnectedEvent,
} from "src/modules/modules.interface.js";
import { ConnectionEventType } from "../../modules.enum.js";

@Injectable()
export class ResumeConnectionListener {
    constructor(private readonly logger: SocketLoggingService) {}

    @OnEvent("socket.connected")
    async handleResumeConnection(event: SocketConnectedEvent) {
        const { client } = event;
        const { query } = client.data;

        //userId가 없으면 이미 ConnectionGateway에서 걸러졌을 것이나 한 번 더 확인
        const userId = client.data.userId;
        if (!userId) return;

        // 기본적으로 모든 사용자는 자신의 userId 룸에 조인 (알림용)
        const userRoom = `user-${userId}`;
        await client.join(userRoom);

        this.logger.log(client, "user_room_joined", {
            roomName: userRoom,
            userId,
        });

        // 만약 Resume 전문 연결이라면 추가 로직 처리 가능
        if (query.type === ConnectionEventType.Resume) {
            this.logger.log(client, "resume_connection_established", { userId });
        }
    }

    @OnEvent("socket.disconnected")
    handleSocketDisconnected(event: SocketDisconnectedEvent) {
        const { client } = event;
        this.logger.log(client, "user_room_left", {
            socketId: client.id,
            userId: client.data.userId,
        });
    }
}
