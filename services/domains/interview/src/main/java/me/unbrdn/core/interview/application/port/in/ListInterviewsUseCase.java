package me.unbrdn.core.interview.application.port.in;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;

public interface ListInterviewsUseCase {
    @Builder
    record ListInterviewsCommand(
            UUID userId, List<InterviewSessionStatus> status, Integer limit, String sort) {}

    List<InterviewSummary> execute(ListInterviewsCommand command);

    @Builder
    record InterviewSummary(
            UUID interviewId,
            Instant startedAt,
            InterviewSessionStatus status,
            String companyName,
            String domain,
            InterviewType type,
            int scheduledDurationMinutes) {}
}
