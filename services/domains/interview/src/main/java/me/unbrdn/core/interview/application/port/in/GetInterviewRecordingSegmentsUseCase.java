package me.unbrdn.core.interview.application.port.in;

import java.util.List;
import java.util.UUID;

public interface GetInterviewRecordingSegmentsUseCase {

    record GetSegmentsQuery(UUID interviewId) {}

    record SegmentResult(
            int turnCount,
            String recordingUrl,
            long expiresAtEpoch,
            String questionContent,
            String answerContent,
            String questionAudioUrl,
            String answerAudioUrl) {}

    List<SegmentResult> execute(GetSegmentsQuery query);
}
