import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { SendSttResultUseCase, SendSttResultCommand } from "../usecases/send-stt-result.usecase";
import { SttTranscriptPayload } from "../../stt/dto/stt-transcript.dto";
import { DebugTraceGateway } from "../../debug/debug-trace.gateway";

@Injectable()
@WebSocketGateway({ cors: { origin: "*" } })
export class InterviewSttListener {
    @WebSocketServer()
    private readonly server: Server;

    constructor(
        private readonly sendSttResultUseCase: SendSttResultUseCase,
        private readonly debugTraceGateway: DebugTraceGateway,
    ) {}

    @OnEvent("stt.transcript.received")
    handleSttTranscript(payload: { data: SttTranscriptPayload; source: "pubsub" | "stream" }) {
        const { data, source } = payload;
        const interviewId = data.interviewId?.toString();

        if (!interviewId) return;

        void this.sendSttResultUseCase.execute(
            new SendSttResultCommand(
                this.server,
                interviewId,
                data.text,
                data.isFinal || false,
                data.engine || "unknown",
                source,
                data.audioReceivedAt,
            ),
        );

        // 트레이스 발행 (개발 환경 전용, 비차단)
        if (process.env.NODE_ENV === "development") {
            this.debugTraceGateway.broadcastTrace(interviewId, "STT", {
                text: data.text,
                isFinal: data.isFinal,
                engine: data.engine,
                source,
                audioReceivedAt: data.audioReceivedAt,
            });
        }
    }
}
