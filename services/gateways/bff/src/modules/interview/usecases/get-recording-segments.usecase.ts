import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "src/infra/grpc/services/interview-grpc.service";

export interface RecordingSegmentResult {
    turnCount: number;
    recordingUrl: string;
    expiresAt: number;
    questionContent: string;
    answerContent: string;
    questionAudioUrl: string;
    answerAudioUrl: string;
}

@Injectable()
export class GetRecordingSegmentsUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(interviewId: string): Promise<RecordingSegmentResult[]> {
        const response =
            await this.interviewGrpcService.getInterviewRecordingSegments(interviewId);
        return (response.segments ?? []).map((s: any) => ({
            turnCount: s.turnCount,
            recordingUrl: s.recordingUrl,
            expiresAt: s.expiresAtEpoch,
            questionContent: s.questionContent,
            answerContent: s.answerContent,
            questionAudioUrl: s.questionAudioUrl,
            answerAudioUrl: s.answerAudioUrl,
        }));
    }
}
