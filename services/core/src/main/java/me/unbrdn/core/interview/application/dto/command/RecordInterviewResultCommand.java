package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RecordInterviewResultCommand {
    private final String userId;
    private final String userAnswer;
    private final String aiAnswer;
    private final String traceId;
}
