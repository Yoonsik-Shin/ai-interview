import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { SendSttResultUseCase, SendSttResultCommand } from "../usecases/send-stt-result.usecase";
import { SttTranscriptPayload } from "../../stt/dto/stt-transcript.dto";

@Injectable()
@WebSocketGateway({ cors: { origin: "*" } })
export class InterviewSttListener {
    @WebSocketServer()
    private readonly server: Server;

    constructor(private readonly sendSttResultUseCase: SendSttResultUseCase) {}

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
    }
}
