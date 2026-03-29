package me.unbrdn.core.interview.application.port.out;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;

public interface LoadRecordingSegmentsPort {

    List<InterviewRecordingSegment> loadByInterviewSessionId(UUID interviewSessionId);

    java.util.Optional<InterviewRecordingSegment> loadByInterviewSessionIdAndTurnCount(
            UUID interviewSessionId, int turnCount);
}
