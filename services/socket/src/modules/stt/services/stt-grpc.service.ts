import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { Subject, Subscription, Observable } from "rxjs";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";

import { AudioChunk, STTResponse } from "@grpc-types/stt";
import { Socket } from "socket.io";

interface SttServiceGrpc {
    speechToText(data: Observable<AudioChunk>): Observable<STTResponse>;
}

@Injectable()
export class SttGrpcService implements OnModuleInit {
    private sttGrpcService: SttServiceGrpc;
    private readonly sttStreams = new Map<
        string,
        { subject: Subject<AudioChunk>; subscription: Subscription }
    >();

    constructor(
        @Inject("STT_PACKAGE")
        private readonly sttClient: ClientGrpc,
        private readonly logger: SocketLoggingService,
    ) {}

    onModuleInit() {
        this.sttGrpcService = this.sttClient.getService<SttServiceGrpc>("SttService");
        this.logger.log(null, "stt_grpc_client_initialized");
    }

    handleGrpcStream(
        client: Socket,
        payload: any,
        audioData: Buffer,
        metadata: any,
        userId: string,
        timestamp: string,
        traceId: string,
        stage: string = "unknown",
    ) {
        // payload에서 mode 직접 사용 (클라이언트가 전달)
        const mode = payload.mode || "practice";

        const audioChunkGrpc: AudioChunk = {
            audioData: audioData,
            isFinal: payload.isFinal || false,
            audioFormat: metadata.format,
            sampleRate: metadata.sampleRate,
            inputGain: metadata.inputGain,
            threshold: metadata.threshold,
            timestamp,
            context: {
                traceId: traceId,
                mode: mode,
                interview: {
                    interviewId: payload.interviewSessionId,
                    userId: userId,
                    stage: stage,
                },
            },
        };

        let streamEntry = this.sttStreams.get(payload.interviewSessionId);
        if (!streamEntry) {
            const subject = new Subject<AudioChunk>();
            const sttResponse$ = this.sttGrpcService.speechToText(subject.asObservable());
            const subscription = sttResponse$.subscribe({
                next: (response: STTResponse) => {
                    this.logger.log(client, "stt_response_received", {
                        interviewSessionId: response.interviewId,
                        text: response.text,
                        isEmpty: response.isEmpty,
                        engine: response.engine,
                    });

                    if (response.isEmpty || !response.text || response.text.trim() === "") {
                        this.logger.log(client, "stt_empty_skipping_llm", {
                            interviewSessionId: response.interviewId,
                        });
                        // 빈 답변 시 클라이언트에 재요청 이벤트 발송
                        client.emit("interview:retry_answer", {
                            message: "다시 말씀해 주시겠어요?",
                        });
                        return;
                    }

                    // Fast Track: Redis Pub/Sub을 거치지 않고 바로 전송 (지연 감소)
                    client.emit("interview:stt_result", {
                        text: response.text,
                        isFinal: true, // 문장 단위 처리이므로 true로 가정 (스트리밍 방식에 따라 다름)
                    });
                },
                error: (err) => {
                    this.logger.log(client, "stt_grpc_stream_failed", {
                        interviewSessionId: payload.interviewSessionId,
                        error: String(err),
                        path: "fast",
                    });
                    this.cleanupSttStream(payload.interviewSessionId, "error");
                },
                complete: () => {
                    this.logger.log(client, "stt_grpc_stream_complete", {
                        interviewSessionId: payload.interviewSessionId,
                        path: "fast",
                    });
                    this.cleanupSttStream(payload.interviewSessionId, "complete");
                },
            });
            streamEntry = { subject, subscription };
            this.sttStreams.set(payload.interviewSessionId, streamEntry);
            this.logger.log(client, "stt_grpc_stream_started", {
                interviewSessionId: payload.interviewSessionId,
            });
        }

        streamEntry.subject.next(audioChunkGrpc);

        if (payload.isFinal) {
            streamEntry.subject.complete();
            this.logger.log(client, "audio_chunk_grpc_success", {
                interviewSessionId: payload.interviewSessionId,
                isFinal: true,
                path: "fast",
            });
        }
    }

    abortStream(interviewSessionId: string) {
        this.logger.log(null, "stt_grpc_stream_aborted", {
            interviewSessionId,
        });
        this.cleanupSttStream(interviewSessionId, "aborted");
    }

    private cleanupSttStream(interviewSessionId: string, reason: string): void {
        const entry = this.sttStreams.get(interviewSessionId);
        if (!entry) {
            return;
        }
        entry.subject.complete();
        entry.subscription.unsubscribe();
        this.sttStreams.delete(interviewSessionId);
        this.logger.log(null, "stt_grpc_stream_closed", {
            interviewSessionId,
            reason,
        });
    }
}
