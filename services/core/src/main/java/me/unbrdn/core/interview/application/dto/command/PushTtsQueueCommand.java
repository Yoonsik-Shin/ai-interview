package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PushTtsQueueCommand {
    private final String interviewId; // 실제 PK (ULID)
    private final String sentence;
    private final int sentenceIndex;
    private final String mode; // "real" | "practice"
    private final String personaId;
}
