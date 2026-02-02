export interface SttTranscriptPayload {
    text: string;
    interviewSessionId: number;
    isFinal: boolean;
    timestamp: string;
    engine: string;
    audioReceivedAt?: string;
    isEmpty?: boolean;
}
