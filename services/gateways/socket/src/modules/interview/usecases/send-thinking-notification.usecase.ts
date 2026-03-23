import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";

export class SendThinkingNotificationCommand {
    constructor(
        public readonly server: Server,
        public readonly interviewId: string,
        public readonly nodeName: string,
        public readonly status: string,
        public readonly message?: string,
    ) {}
}

@Injectable()
export class SendThinkingNotificationUseCase {
    async execute(command: SendThinkingNotificationCommand): Promise<void> {
        const { server, interviewId, nodeName, status, message } = command;
        const room = `interview:${interviewId}`;

        server.to(room).emit("interview:thinking", {
            nodeName,
            status,
            message,
        });
    }
}
