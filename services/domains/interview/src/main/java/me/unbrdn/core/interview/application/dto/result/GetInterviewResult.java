package me.unbrdn.core.interview.application.dto.result;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import me.unbrdn.core.interview.domain.enums.InterviewRound;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;

@Builder
public record GetInterviewResult(
        UUID interviewId,
        InterviewSessionStatus status,
        me.unbrdn.core.interview.domain.enums.InterviewStage currentStage,
        InterviewType type,
        String companyName,
        String domain,
        int scheduledDurationMinutes,
        java.util.List<String> participatingPersonas,
        InterviewRound round,
        Instant startedAt,
        Instant createdAt,
        String jobPostingUrl,
        String selfIntroText,
        int turnCount) {}
