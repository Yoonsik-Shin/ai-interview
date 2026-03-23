export interface SttTranscriptPayload {
    text: string;
    interviewId: string;
    isFinal: boolean;
    timestamp: string;
    engine: string;
    audioReceivedAt?: string;
    isEmpty?: boolean;
}
