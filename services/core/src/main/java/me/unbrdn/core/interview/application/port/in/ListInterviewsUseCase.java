package me.unbrdn.core.interview.application.port.in;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;

public interface ListInterviewsUseCase {
    List<InterviewSummary> execute(UUID userId);

    @Builder
    record InterviewSummary(
            UUID interviewId,
            LocalDateTime startedAt,
            InterviewSessionStatus status,
            String domain,
            InterviewType type,
            int targetDurationMinutes,
            int interviewerCount) {}
}
