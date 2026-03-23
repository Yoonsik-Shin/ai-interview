package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProcessUserAnswerCommand {
    private final String interviewId;
    private final String userId;
    private final String userText;
    private final String persona;
    private final String traceId;
}
