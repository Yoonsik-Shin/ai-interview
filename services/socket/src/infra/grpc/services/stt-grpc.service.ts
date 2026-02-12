import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { Subject, Subscription, Observable } from "rxjs";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { AudioChunk, STTResponse } from "@grpc-types/stt/v1/stt";
import { AuthenticatedSocket } from "../../../types/socket.types";
import { AudioChunkDto } from "../../../modules/stt/dto/audio-chunk.dto";

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
        client: AuthenticatedSocket,
        payload: AudioChunkDto,
        audioData: Buffer,
        metadata: any,
        userId: string,
        timestamp: string,
        traceId: string,
        stage: string = "unknown",
    ) {
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
                        client.emit("interview:retry_answer", {
                            message: "다시 말씀해 주시겠어요?",
                        });
                        return;
                    }

                    client.emit("interview:stt_result", {
                        text: response.text,
                        isFinal: true,
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
