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
    private final String persona;
    private final String mode; // "real" | "practice"
}
