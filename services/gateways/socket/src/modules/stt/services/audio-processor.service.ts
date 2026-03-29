import { Injectable } from "@nestjs/common";
import { SocketLoggingService } from "../../../core/logging/socket-logging.service";
import { SttGrpcService } from "../../../infra/grpc/services/stt-grpc.service";
import { SttStorageService } from "../../../infra/redis/services/stt-storage.service";
import { AudioChunkDto } from "../dto/audio-chunk.dto";
import { AuthenticatedSocket } from "../../../types/socket.types";
import { RedisClient } from "../../../infra/redis/redis.clients";

@Injectable()
export class AudioProcessorService {
    constructor(
        private readonly logger: SocketLoggingService,
        private readonly sttGrpcService: SttGrpcService,
        private readonly sttStorageService: SttStorageService,
        private readonly redisClient: RedisClient,
    ) {}

    private readonly recordingStartedMap = new Map<string, boolean>();
    private readonly preRollBufferMap = new Map<
        string,
        Array<{
            payload: AudioChunkDto;
            audioData: Buffer;
            metadata: any;
            timestamp: string;
        }>
    >();

    async processAudio(
        client: AuthenticatedSocket,
        payload: AudioChunkDto,
        stage: string = "unknown",
    ): Promise<void> {
        try {
            const userId = client.data.userId || "unknown";
            const traceId = client.data.traceId || "unknown";
            const interviewId = payload.interviewId;

            const audioData = this.decodeAudio(payload.chunk);
            const timestamp = new Date().toISOString();

            // [FIX] Use local hint key (interview:rt:) for MSA decoupling

            this.logIfFinalChunk(client, payload, userId, stage, 0);

            const metadata = this.createMetadata(payload, timestamp, traceId, userId);

            // Fast Track: gRPC Stream (STT) - Always send for VAD/STT
            this.sttGrpcService.handleGrpcStream(
                client,
                payload,
                audioData,
                metadata,
                userId,
                timestamp,
                traceId,
                stage,
                0,
            );

            // Safe Path: Redis Queue -> Storage -> Object Storage
            // [NEW] 발화가 시작되기 전까지는 버퍼에만 저장 (무음 제거)
            if (stage === "SELF_INTRO" || stage === "IN_PROGRESS") {
                if (!this.recordingStartedMap.get(interviewId)) {
                    this.bufferForPreRoll(interviewId, { payload, audioData, metadata, timestamp });
                    return;
                }
            }

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

    /** STT 서비스로부터 VAD_START 수신 시 호출 */
    async startRecording(interviewId: string) {
        if (this.recordingStartedMap.get(interviewId)) return;

        this.logger.log(null, "recording_started_by_vad", { interviewId });
        this.recordingStartedMap.set(interviewId, true);

        // 버퍼링된 데이터(Pre-roll)를 일괄 전송
        const buffer = this.preRollBufferMap.get(interviewId);
        if (buffer && buffer.length > 0) {
            this.logger.log(null, "flushing_pre_roll_buffer", {
                interviewId,
                count: buffer.length,
            });
            for (const item of buffer) {
                await this.sttStorageService.pushToRedis(
                    null as any, // client is not strictly needed for pushToRedis logic
                    item.payload,
                    item.audioData,
                    item.metadata,
                    item.timestamp,
                );
            }
            this.preRollBufferMap.delete(interviewId);
        }
    }

    private bufferForPreRoll(interviewId: string, item: any) {
        let buffer = this.preRollBufferMap.get(interviewId);
        if (!buffer) {
            buffer = [];
            this.preRollBufferMap.set(interviewId, buffer);
        }
        buffer.push(item);

        // 최대 1.5초(약 15개 청크)만 보관
        if (buffer.length > 15) {
            buffer.shift();
        }
    }

    // [중요] 단계 전이 시 상태 초기화 필요 (예: 자기소개 종료 후 다음 질문 대기 시 다시 무음 제거)
    resetRecordingFlag(interviewId: string) {
        this.recordingStartedMap.set(interviewId, false);
        this.preRollBufferMap.delete(interviewId);
    }

    private decodeAudio(chunk: Buffer | string): Buffer {
        if (Buffer.isBuffer(chunk)) return chunk;
        if (typeof chunk === "string") {
            return Buffer.from(chunk, "base64");
        }
        throw new Error("Invalid audio chunk format");
    }

    private createMetadata(
        payload: AudioChunkDto,
        timestamp: string,
        traceId: string,
        userId: string,
    ) {
        return {
            interview_id: payload.interviewId,
            user_id: userId,
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
        stage: string,
        retryCount: number,
    ): void {
        if (payload.isFinal) {
            this.logger.log(client, "audio_chunk_final_received", {
                interviewId: payload.interviewId,
                userId,
                stage,
                retryCount,
            });

            // [FIX] 자기소개(SELF_INTRO) 단계에서 오디오가 종료되면 STT 최종 결과를 기다리지 않고 즉시 전이를 촉발 (Fast-Path)
            // STT 서버의 후처리 지연(Whisper Finalization)을 우회하기 위함
            if (stage === "SELF_INTRO") {
                this.triggerFastPathTransition(client, payload, userId).catch((err) => {
                    this.logger.error(client, "fast_path_transition_error", {
                        interviewId: payload.interviewId,
                        error: String(err),
                    });
                });
            }
        }
    }

    private async triggerFastPathTransition(
        client: AuthenticatedSocket,
        payload: AudioChunkDto,
        userId: string,
    ) {
        // 짧은 대기(300ms)를 통해 마지막 부분적인 STT 결과를 최대한 확보
        await new Promise((resolve) => setTimeout(resolve, 300));

        const interviewId = payload.interviewId;
        const text = this.sttGrpcService.getLatestTranscript(interviewId);
        const traceId = client.data.traceId || "unknown";

        this.logger.log(client, "triggering_fast_path_transition", {
            interviewId,
            textLen: text.length,
        });

        const sttPayload = {
            interviewId,
            userId,
            text: text || "(자기소개 내용 없음)",
            traceId,
            retryCount: 0,
            stage: "SELF_INTRO", // Fast-path transition for self-intro
            isFinal: true,
            isEmpty: !text || text.trim() === "",
        };

        // Redis Stream (interview:transcript:process)에 직접 발행하여 Core의 ProcessUserAnswer 트리거
        try {
            await this.redisClient.xadd(
                "interview:transcript:process",
                "*",
                "payload",
                JSON.stringify(sttPayload),
            );
        } catch (error) {
            this.logger.error(client, "fast_path_redis_push_error", {
                interviewId,
                error: String(error),
            });
        }
    }

    abortProcessing(interviewId: string) {
        this.sttGrpcService.abortStream(interviewId);
    }
}
