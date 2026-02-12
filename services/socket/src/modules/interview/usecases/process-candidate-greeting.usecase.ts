import { Injectable } from "@nestjs/common";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../../infra/grpc/services/interview-grpc.service";
import { AudioProcessorService } from "../../stt/services/audio-processor.service";

import { AudioProcessor, AudioProcessingCommand } from "./audio-processor.interface";

@Injectable()
export class ProcessCandidateGreetingUseCase implements AudioProcessor {
    constructor(
        private readonly stageService: InterviewGrpcService,
        private readonly audioProcessorService: AudioProcessorService,
    ) {}

    async execute(command: AudioProcessingCommand): Promise<void> {
        const { client, payload } = command;
        await this.audioProcessorService.processAudio(client, payload, "CANDIDATE_GREETING");

        if (payload.isFinal) {
            const nextStage = await this.stageService.transitionStage(
                payload.interviewSessionId,
                InterviewStage.INTERVIEWER_INTRO,
            );
            client.emit("interview:stage_changed", {
                interviewSessionId: payload.interviewSessionId,
                previousStage: InterviewStage.CANDIDATE_GREETING,
                currentStage: nextStage,
            });
        }
    }
}
