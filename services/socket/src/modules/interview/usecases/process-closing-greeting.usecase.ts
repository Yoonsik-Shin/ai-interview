import { Injectable } from "@nestjs/common";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../../infra/grpc/services/interview-grpc.service";
import { AudioProcessorService } from "../../stt/services/audio-processor.service";

import { AudioProcessor, AudioProcessingCommand } from "./audio-processor.interface";

@Injectable()
export class ProcessClosingGreetingUseCase implements AudioProcessor {
    constructor(
        private readonly stageService: InterviewGrpcService,
        private readonly audioProcessorService: AudioProcessorService,
    ) {}

    async execute(command: AudioProcessingCommand): Promise<void> {
        const { client, payload } = command;
        await this.audioProcessorService.processAudio(client, payload, "CLOSING_GREETING");

        if (payload.isFinal) {
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.COMPLETED,
            );
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: InterviewStage.CLOSING_GREETING,
                currentStage: nextStage,
            });
        }
    }
}
