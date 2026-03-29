package me.unbrdn.core.interview.application.event;

import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.interview.domain.enums.InterviewStage;

@Getter
@Builder
public class LlmResponseCompletedEvent {
    private final String interviewId;
    private final String userId;
    private final String mode;
    private final InterviewStage stage;
    private final boolean isEndSignal;
}
