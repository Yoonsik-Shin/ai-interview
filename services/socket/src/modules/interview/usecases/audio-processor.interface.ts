import { Socket } from "socket.io";
import { AudioChunkDto } from "../../stt/dto/audio-chunk.dto";

/** 오디오 처리를 위한 통합 명령 DTO */
export class AudioProcessingCommand {
    constructor(
        public readonly client: Socket,
        public readonly payload: AudioChunkDto,
    ) {}
}

/** 오디오 처리 UseCase 인터페이스 (Factory 패턴용) */
export interface AudioProcessor {
    execute(command: AudioProcessingCommand): Promise<void>;
}
