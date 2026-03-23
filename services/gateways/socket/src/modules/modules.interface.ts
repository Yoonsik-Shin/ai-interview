import { Socket } from "socket.io";
import { ConnectionEventType } from "./modules.enum";

export interface SocketConnectedEvent {
    client: Socket & {
        data: {
            userId: string;
            traceId: string;
            query: {
                type: ConnectionEventType;
                [key: string]: any;
            };
            [key: string]: any;
        };
    };
}

export interface SocketDisconnectedEvent {
    client: Socket & {
        data: {
            userId: string;
            traceId: string;
            query: {
                type: ConnectionEventType;
                [key: string]: any;
            };
            [key: string]: any;
        };
    };
}
