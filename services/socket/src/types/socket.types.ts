import { Socket } from "socket.io";

export interface SocketData {
    userId?: string;
    traceId?: string;
    query?: any; // query may contain various parameters
}

export type AuthenticatedSocket = Socket<any, any, any, SocketData>;
