import { Injectable } from "@nestjs/common";
import { Socket } from "socket.io";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { SttGrpcService } from "./stt-grpc.service";
import { SttStorageService } from "./stt-storage.service";
import { AudioChunkDto } from "../dto/audio-chunk.dto";

@Injectable()
export class ProcessAudioService {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly sttGrpcService: SttGrpcService,
        private readonly sttStorageService: SttStorageService,
    ) {}

    async processAudio(client: Socket, payload: AudioChunkDto): Promise<void> {
        try {
            const userId = (client as any).userId;
            const traceId = (client as any).traceId || "unknown";

            this.logIfFinalChunk(client, payload, userId);

            const audioData = this.decodeAudio(payload.chunk);
            const timestamp = new Date().toISOString();
            const metadata = this.createMetadata(payload, timestamp, traceId);

            // 1. Slow Track (Redis Storage) - Reliability First
            // 데이터 유실 방지를 위해 가장 먼저 저장
            await this.sttStorageService.pushToRedis(
                client,
                payload,
                audioData, // Pass Buffer directly
                metadata,
                timestamp,
            );

            // 2. Ack to Client (Storage Guaranteed)
            // 저장이 확실시된 후에 클라이언트에게 성공 응답
            this.sendAck(client, payload, timestamp);

            // 3. Fast Track (gRPC) - Best Effort
            // 실시간 처리는 별도로 진행 (여기서 에러나도 저장은 이미 되었음)
            try {
                this.sttGrpcService.handleGrpcStream(
                    client,
                    payload,
                    audioData,
                    metadata,
                    userId,
                    timestamp,
                    traceId,
                );
            } catch (grpcError) {
                // gRPC 에러는 로그만 남기고 전체 흐름을 방해하지 않음
                this.logger.error(client, "stt_grpc_dispatch_failed", {
                    interviewSessionId: payload.interviewSessionId,
                    error: String(grpcError),
                });
            }
        } catch (error) {
            this.handleError(client, payload, error);
        }
    }

    private logIfFinalChunk(client: Socket, payload: AudioChunkDto, userId: string) {
        if (payload.isFinal) {
            this.logger.log(client, "audio_chunk_FINAL_received", {
                interviewSessionId: payload.interviewSessionId,
                userId,
                isFinal: true,
                chunkId: payload.chunkId,
                format: payload.format,
                sampleRate: payload.sampleRate,
            });
        }
    }

    private decodeAudio(chunk: string | Buffer): Buffer {
        return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "base64");
    }

    private createMetadata(payload: AudioChunkDto, timestamp: string, traceId: string) {
        return {
            format: payload.format || "pcm16",
            sampleRate: payload.sampleRate || 16000,
            channels: 1,
            inputGain: payload.inputGain ?? 1.0,
            threshold: payload.threshold ?? 0,
            timestamp,
            traceId,
        };
    }

    private sendAck(client: Socket, payload: AudioChunkDto, timestamp: string) {
        this.logger.debug(client, "audio_ack_sending", {
            chunkId: payload.chunkId,
            interviewSessionId: payload.interviewSessionId,
            isFinal: payload.isFinal,
        });

        client.emit("interview:audio_ack", {
            chunkId: payload.chunkId,
            interviewSessionId: payload.interviewSessionId,
            timestamp,
            isFinal: payload.isFinal,
        });
    }

    private handleError(client: Socket, payload: AudioChunkDto, error: unknown) {
        const userId = (client as any).userId;
        this.logger.error(client, "audio_chunk_processing_failed", {
            interviewSessionId: payload.interviewSessionId,
            userId,
            error: String(error),
        });
        client.emit("interview:error", {
            code: "AUDIO_PROCESSING_FAILED",
            message: "Failed to process audio chunk",
        });
    }
    abortProcessing(interviewSessionId: string) {
        this.sttGrpcService.abortStream(interviewSessionId);
    }
}
