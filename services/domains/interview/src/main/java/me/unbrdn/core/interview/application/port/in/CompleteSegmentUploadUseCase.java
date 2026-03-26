package me.unbrdn.core.interview.application.port.in;

import java.time.Instant;
import java.util.UUID;

public interface CompleteSegmentUploadUseCase {

    record CompleteSegmentCommand(
            UUID interviewId,
            String objectKey,
            int turnCount,
            Integer durationSeconds,
            Instant startedAt,
            Instant endedAt) {}

    void execute(CompleteSegmentCommand command);
}
