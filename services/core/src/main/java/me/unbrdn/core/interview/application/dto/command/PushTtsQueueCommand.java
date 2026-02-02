package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PushTtsQueueCommand {
    private final String interviewId; // legacy sessionUuid
    private final String interviewSessionId; // 실제 PK (ULID)
    private final String sentence;
    private final int sentenceIndex;
    private final String persona;
    private final String mode; // "real" | "practice"
}
