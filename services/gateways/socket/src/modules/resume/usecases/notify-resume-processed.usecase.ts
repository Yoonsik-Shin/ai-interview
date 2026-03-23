import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";

export class NotifyResumeProcessedCommand {
    constructor(
        public readonly server: Server,
        public readonly userId: string,
        public readonly resumeId: string,
        public readonly status: string,
    ) {}
}

@Injectable()
export class NotifyResumeProcessedUseCase {
    async execute(command: NotifyResumeProcessedCommand): Promise<void> {
        const { server, userId, resumeId, status } = command;
        const userRoom = `user-${userId}`;

        server.to(userRoom).emit("resume:processed", {
            resumeId,
            status,
            timestamp: new Date().toISOString(),
        });
    }
}
