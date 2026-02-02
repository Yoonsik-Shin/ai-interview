export class AudioChunkDto {
    chunk: Buffer | string;
    interviewSessionId: string;
    isFinal?: boolean;
    format?: string;
    sampleRate?: number;
    inputGain?: number;
    threshold?: number;
    chunkId?: string;
    mode?: "real" | "practice"; // Engine selection
}
