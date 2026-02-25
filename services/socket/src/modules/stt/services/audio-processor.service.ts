import { Injectable } from "@nestjs/common";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { SttGrpcService } from "../../../infra/grpc/services/stt-grpc.service";
import { SttStorageService } from "../../../infra/redis/services/stt-storage.service";
import { AudioChunkDto } from "../dto/audio-chunk.dto";
import { AuthenticatedSocket } from "../../../types/socket.types";

@Injectable()
export class AudioProcessorService {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly sttGrpcService: SttGrpcService,
        private readonly sttStorageService: SttStorageService,
    ) {}

    async processAudio(
        client: AuthenticatedSocket,
        payload: AudioChunkDto,
        stage: string = "unknown",
    ): Promise<void> {
        try {
            const userId = client.data.userId || "unknown";
            const traceId = client.data.traceId || "unknown";

            this.logIfFinalChunk(client, payload, userId);

            const audioData = this.decodeAudio(payload.chunk);
            const timestamp = new Date().toISOString();
            const metadata = this.createMetadata(payload, timestamp, traceId);

            // Fast Track: gRPC Stream (STT)
            this.sttGrpcService.handleGrpcStream(
                client,
                payload,
                audioData,
                metadata,
                userId,
                timestamp,
                traceId,
                stage,
            );

            // Safe Path: Redis Queue -> Storage -> Object Storage
            await this.sttStorageService.pushToRedis(
                client,
                payload,
                audioData,
                metadata,
                timestamp,
            );
        } catch (error) {
            this.logger.error(client, "audio_processing_error", {
                interviewId: payload.interviewId,
                error: String(error),
            });
        }
    }

    private decodeAudio(chunk: Buffer | string): Buffer {
        if (Buffer.isBuffer(chunk)) return chunk;
        if (typeof chunk === "string") {
            return Buffer.from(chunk, "base64");
        }
        throw new Error("Invalid audio chunk format");
    }

    private createMetadata(payload: AudioChunkDto, timestamp: string, traceId: string) {
        return {
            interview_id: payload.interviewId,
            format: payload.format || "pcm16", // Storage service expects 'format'
            audio_format: payload.format || "pcm16", // STT service expects 'audio_format'
            sample_rate: payload.sampleRate || 16000,
            input_gain: payload.inputGain || 1.0,
            threshold: payload.threshold || -50,
            timestamp,
            trace_id: traceId,
        };
    }

    private logIfFinalChunk(
        client: AuthenticatedSocket,
        payload: AudioChunkDto,
        userId: string,
    ): void {
        if (payload.isFinal) {
            this.logger.log(client, "audio_chunk_final_received", {
                interviewId: payload.interviewId,
                userId,
            });
        }
    }

    abortProcessing(interviewId: string) {
        this.sttGrpcService.abortStream(interviewId);
    }
}
