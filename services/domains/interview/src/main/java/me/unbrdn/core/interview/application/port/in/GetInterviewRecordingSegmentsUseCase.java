package me.unbrdn.core.interview.application.port.in;

import java.util.List;
import java.util.UUID;

public interface GetInterviewRecordingSegmentsUseCase {

    record GetSegmentsQuery(UUID interviewId) {}

    record SegmentResult(int turnCount, String recordingUrl, long expiresAtEpoch) {}

    List<SegmentResult> execute(GetSegmentsQuery query);
}
