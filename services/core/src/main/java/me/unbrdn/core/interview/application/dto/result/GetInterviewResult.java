package me.unbrdn.core.interview.application.dto.result;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;

@Builder
public record GetInterviewResult(
        UUID interviewId,
        InterviewSessionStatus status,
        InterviewType type,
        String domain,
        int targetDurationMinutes,
        String selfIntroduction,
        InterviewPersonality personality,
        Instant startedAt,
        Instant createdAt) {}
