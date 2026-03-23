import { Injectable } from "@nestjs/common";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../../infra/grpc/services/interview-grpc.service";
import { AudioProcessorService } from "../../stt/services/audio-processor.service";

import { AudioProcessor, AudioProcessingCommand } from "./audio-processor.interface";

@Injectable()
export class ProcessLastAnswerUseCase implements AudioProcessor {
    constructor(
        private readonly stageService: InterviewGrpcService,
        private readonly audioProcessorService: AudioProcessorService,
    ) {}

    async execute(command: AudioProcessingCommand): Promise<void> {
        const { client, payload } = command;
        await this.audioProcessorService.processAudio(client, payload, "LAST_ANSWER");

        if (payload.isFinal) {
            const nextStage = await this.stageService.transitionStage(
                payload.interviewId,
                InterviewStage.CLOSING_GREETING,
            );
            client.emit("interview:stage_changed", {
                interviewId: payload.interviewId,
                previousStage: InterviewStage.LAST_ANSWER,
                currentStage: nextStage,
            });
        }
    }
}
