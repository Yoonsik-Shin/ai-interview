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
            sampleRate: metadata.sample_rate,
            inputGain: metadata.input_gain,
            threshold: metadata.threshold,
            timestamp,
            context: {
                traceId: traceId,
                mode: mode,
                interview: {
                    interviewId: payload.interviewId,
                    userId: userId,
                    stage: stage,
                },
            },
        };

        let streamEntry = this.sttStreams.get(payload.interviewId);
        if (!streamEntry) {
            const subject = new Subject<AudioChunk>();
            const sttResponse$ = this.sttGrpcService.speechToText(subject.asObservable());
            const subscription = sttResponse$.subscribe({
                next: (response: STTResponse) => {
                    this.logger.log(client, "stt_response_received", {
                        interviewId: response.interviewId,
                        text: response.text,
                        isEmpty: response.isEmpty,
                        engine: response.engine,
                    });

                    if (response.isEmpty || !response.text || response.text.trim() === "") {
                        this.logger.log(client, "stt_empty_skipping_llm", {
                            interviewId: response.interviewId,
                        });
                        // Do NOT emit retry_answer here for every empty response.
                        // We should only handle this in a turn-based context if needed.
                        return;
                    }

                    client.emit("interview:stt_result", {
                        text: response.text,
                        isFinal: true,
                    });
                },
                error: (err) => {
                    this.logger.log(client, "stt_grpc_stream_failed", {
                        interviewId: payload.interviewId,
                        error: String(err),
                        path: "fast",
                    });
                    this.cleanupSttStream(payload.interviewId, "error");
                },
                complete: () => {
                    this.logger.log(client, "stt_grpc_stream_complete", {
                        interviewId: payload.interviewId,
                        path: "fast",
                    });
                    this.cleanupSttStream(payload.interviewId, "complete");
                },
            });
            streamEntry = { subject, subscription };
            this.sttStreams.set(payload.interviewId, streamEntry);
            this.logger.log(client, "stt_grpc_stream_started", {
                interviewId: payload.interviewId,
            });
        }

        streamEntry.subject.next(audioChunkGrpc);

        if (payload.isFinal) {
            streamEntry.subject.complete();
            this.logger.log(client, "audio_chunk_grpc_success", {
                interviewId: payload.interviewId,
                isFinal: true,
                path: "fast",
            });
        }
    }

    abortStream(interviewId: string) {
        this.logger.log(null, "stt_grpc_stream_aborted", {
            interviewId,
        });
        this.cleanupSttStream(interviewId, "aborted");
    }

    private cleanupSttStream(interviewId: string, reason: string): void {
        const entry = this.sttStreams.get(interviewId);
        if (!entry) {
            return;
        }
        entry.subject.complete();
        entry.subscription.unsubscribe();
        this.sttStreams.delete(interviewId);
        this.logger.log(null, "stt_grpc_stream_closed", {
            interviewId,
            reason,
        });
    }
}
