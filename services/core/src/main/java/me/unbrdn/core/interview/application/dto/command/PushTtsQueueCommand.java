package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PushTtsQueueCommand {
    private final String interviewId;
    private final String sentence;
    private final int sentenceIndex;
    private final String persona;
    private final String mode; // "real" | "practice"
}
