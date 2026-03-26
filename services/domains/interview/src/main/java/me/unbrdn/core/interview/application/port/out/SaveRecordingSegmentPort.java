package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;

public interface SaveRecordingSegmentPort {
    InterviewRecordingSegment save(InterviewRecordingSegment segment);
}
