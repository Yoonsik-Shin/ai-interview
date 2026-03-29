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
    private readonly latestTranscripts = new Map<string, string>();

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
        retryCount: number = 0,
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
                    retryCount: retryCount,
                },
                general: undefined,
            },
        };

        let streamEntry = this.sttStreams.get(payload.interviewId);

        // [FUNDAMENTAL FIX] 단계(stage)나 리트라이 횟수(retryCount)가 변경되면 기존 스트림을 파기하고 새로 생성합니다.
        // 이는 이전 시도의 잔류 데이터(Residue)가 현재 시도의 상태를 오염시키는 것을 물리적으로 차단하는 가장 확실한 방법입니다.
        if (streamEntry) {
            const firstChunk = (streamEntry as any).firstChunkContext;
            if (firstChunk && (firstChunk.stage !== stage || firstChunk.retryCount !== retryCount)) {
                this.logger.log(client, "stt_grpc_stream_reset_due_to_version_mismatch", {
                    interviewId: payload.interviewId,
                    oldStage: firstChunk.stage,
                    newStage: stage,
                    oldRetry: firstChunk.retryCount,
                    newRetry: retryCount,
                });
                this.cleanupSttStream(payload.interviewId, "version_mismatch");
                streamEntry = undefined;
            }
        }

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
                        // 스트림 생성 시점의 컨텍스트를 응답에 포함하여 전달 (Core에서 필터링 가능하도록)
                        stage,
                        retryCount,
                    });

                    if (response.isEmpty || !response.text || response.text.trim() === "") {
                        return;
                    }

                    if (response.text) {
                        this.latestTranscripts.set(response.interviewId, response.text);
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
            (streamEntry as any).firstChunkContext = { stage, retryCount };
            this.sttStreams.set(payload.interviewId, streamEntry);
            this.logger.log(client, "stt_grpc_stream_started", {
                interviewId: payload.interviewId,
                stage,
                retryCount,
            });
        }

        streamEntry.subject.next(audioChunkGrpc);

        if (payload.isFinal) {
            streamEntry.subject.complete();
        }
    }

    abortStream(interviewId: string) {
        this.logger.log(null, "stt_grpc_stream_aborted", {
            interviewId,
        });
        this.cleanupSttStream(interviewId, "aborted");
    }

    getLatestTranscript(interviewId: string): string {
        return this.latestTranscripts.get(interviewId) || "";
    }

    private cleanupSttStream(interviewId: string, reason: string): void {
        const entry = this.sttStreams.get(interviewId);
        if (!entry) {
            return;
        }
        entry.subject.complete();
        entry.subscription.unsubscribe();
        this.sttStreams.delete(interviewId);
        this.latestTranscripts.delete(interviewId);
        this.logger.log(null, "stt_grpc_stream_closed", {
            interviewId,
            reason,
        });
    }
}
