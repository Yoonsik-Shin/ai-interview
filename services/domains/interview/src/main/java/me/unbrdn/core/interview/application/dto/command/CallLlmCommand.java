package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.interview.domain.enums.InterviewRound;
import me.unbrdn.core.interview.domain.enums.InterviewStage;

@Getter
@Builder
public class CallLlmCommand {
    private final String interviewId;
    private final String resumeId;
    private final String userId;
    private final String userText;
    private final String inputRole; // "user" or "system"
    private final String personaId;
    private final String mode; // "real" | "practice"
    private final InterviewRound round; // 면접 차수
    private final InterviewStage stage;
    private final int interviewerCount;
    private final String domain;
    private final String companyName;
    private final int scheduledDurationMinutes;
    private final long remainingTimeSeconds;
    private final int currentDifficultyLevel;
    private final String lastInterviewerId;
    private final java.util.List<String> participatingPersonas;
    private final String jobPostingUrl;
    private final String selfIntroText;
    private final String forcedSpeakerId;
}
