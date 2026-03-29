export class AudioChunkDto {
    chunk: Buffer | string;
    interviewId: string;
    isFinal?: boolean;
    format?: string;
    sampleRate?: number;
    inputGain?: number;
    threshold?: number;
    chunkId?: string;
    mode?: "real" | "practice"; // Engine selection
    retryCount?: number; // Versioning for retry attempts
}
