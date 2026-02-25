package me.unbrdn.core.interview.application.dto.result;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.InterviewType;

@Builder
public record GetInterviewResult(
        UUID interviewId,
        InterviewSessionStatus status,
        InterviewStage currentStage,
        InterviewType type,
        String domain,
        int targetDurationMinutes,
        String selfIntroduction,
        List<InterviewRole> interviewerRoles,
        InterviewPersonality personality,
        int interviewerCount,
        Instant startedAt,
        Instant createdAt,
        Instant resumedAt) {}
