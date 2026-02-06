package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProcessLlmTokenCommand {
    private final String interviewId; // legacy sessionUuid
    private final String interviewSessionId; // 실제 PK (ULID)
    private final String userId;
    private final String userText;
    private final String token;
    private final String thinking;
    private final boolean isSentenceEnd;
    private final boolean isFinal;
    private final String persona; // Deprecated or kept for compatibility mapping
    private final String mode; // "real" | "practice"
    private final String inputRole; // "user" or "system"

    // New Fields from LLM
    private final String currentPersonaId;
    private final int nextDifficultyLevel;
    private final boolean reduceTotalTime;
    private final boolean interviewEndSignal;
}
