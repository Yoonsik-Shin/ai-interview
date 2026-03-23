import { Injectable } from "@nestjs/common";
import { AudioProcessorService } from "../../stt/services/audio-processor.service";

import { AudioProcessor, AudioProcessingCommand } from "./audio-processor.interface";

@Injectable()
export class ProcessNormalQAUseCase implements AudioProcessor {
    constructor(private readonly audioProcessorService: AudioProcessorService) {}

    async execute(command: AudioProcessingCommand): Promise<void> {
        const { client, payload } = command;
        await this.audioProcessorService.processAudio(client, payload, "IN_PROGRESS");
    }
}
