import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AudioProcessorService } from "../stt/services/audio-processor.service";
import { AudioChunkDto } from "../stt/dto/audio-chunk.dto";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../infra/grpc/services/interview-grpc.service";
import { SocketLoggingService } from "../../core/logging/socket-logging.service";
import { SyncStageUseCase, SyncStageCommand } from "./usecases/sync-stage.usecase";
import { AudioProcessorFactory } from "./usecases/audio-processor.factory";
import { AudioProcessingCommand } from "./usecases/audio-processor.interface";

@WebSocketGateway({ cors: { origin: "*" } })
export class InterviewGateway {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly stageService: InterviewGrpcService,
        private readonly logger: SocketLoggingService,
        private readonly syncStageUseCase: SyncStageUseCase,
        private readonly audioProcessorService: AudioProcessorService,
        private readonly processorFactory: AudioProcessorFactory,
    ) {}

    /**
     * 클라이언트가 현재 단계 준비 완료(예: 안내 오디오 재생 완료)를 알림
     */
    @SubscribeMessage("interview:stage_ready")
    async handleStageReady(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: { interviewSessionId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "stage_ready_received", payload);

        const result = await this.syncStageUseCase.execute(
            new SyncStageCommand(
                client,
                payload.interviewSessionId,
                payload.currentStage,
                undefined,
                "READY",
            ),
        );

        if (result.currentStage !== payload.currentStage) {
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: result.previousStage,
                currentStage: result.currentStage,
            });
        }
    }

    @SubscribeMessage("debug:skip_stage")
    async handleDebugSkipStage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewSessionId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "debug_skip_stage", payload);
        let targetStage: InterviewStage | null = null;

        switch (payload.currentStage) {
            case InterviewStage.GREETING:
                targetStage = InterviewStage.CANDIDATE_GREETING;
                break;
            case InterviewStage.CANDIDATE_GREETING:
                targetStage = InterviewStage.INTERVIEWER_INTRO;
                break;
            case InterviewStage.INTERVIEWER_INTRO:
                targetStage = InterviewStage.SELF_INTRO_PROMPT;
                break;
            case InterviewStage.SELF_INTRO_PROMPT:
                targetStage = InterviewStage.SELF_INTRO;
                break;
            case InterviewStage.SELF_INTRO:
                targetStage = InterviewStage.IN_PROGRESS;
                break;
            default:
                this.logger.warn(client, "skip_stage_not_supported", payload);
                return;
        }

        const result = await this.syncStageUseCase.execute(
            new SyncStageCommand(
                client,
                payload.interviewSessionId,
                payload.currentStage,
                targetStage,
                "DEBUG_SKIP",
            ),
        );

        client.emit("interview:stage_changed", {
            interviewSessionId: payload.interviewSessionId,
            previousStage: result.previousStage,
            currentStage: result.currentStage,
        });
    }

    /**
     * 사용자가 단계 스킵 요청 (예: 자기소개 건너뛰기)
     */
    @SubscribeMessage("interview:skip_stage")
    async handleSkipStage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewSessionId: string; currentStage: InterviewStage },
    ): Promise<void> {
        this.logger.log(client, "user_skip_stage", payload);

        const result = await this.syncStageUseCase.execute(
            new SyncStageCommand(
                client,
                payload.interviewSessionId,
                payload.currentStage,
                undefined,
                "SKIP",
            ),
        );

        if (result.currentStage !== payload.currentStage) {
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: result.previousStage,
                currentStage: result.currentStage,
            });

            if (result.isIntervened) {
                client.emit("interview:intervene", {
                    message: result.interventionMessage,
                });
            }
        }
    }

    /**
     * 오디오 청크 처리 - Factory를 통한 프로세서 라우팅
     */
    @SubscribeMessage("interview:audio_chunk")
    async handleAudioChunk(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AudioChunkDto,
    ): Promise<void> {
        try {
            const { stage } = await this.stageService.getStage(payload.interviewSessionId);
            const processor = this.processorFactory.getProcessor(stage);

            if (processor) {
                await processor.execute(new AudioProcessingCommand(client, payload));
            } else {
                this.logger.warn(client, "audio_chunk_no_processor_for_stage", {
                    interviewSessionId: payload.interviewSessionId,
                    stage,
                });
            }
        } catch (error) {
            this.logger.error(client, "audio_chunk_processing_failed", {
                interviewSessionId: payload.interviewSessionId,
                error: String(error),
            });
        }
    }

    @SubscribeMessage("interview:abort_stream")
    handleAbortStream(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { interviewSessionId: string },
    ): void {
        this.logger.log(client, "client_requested_abort", {
            interviewSessionId: payload.interviewSessionId,
        });
        this.audioProcessorService.abortProcessing(payload.interviewSessionId);
    }
}
