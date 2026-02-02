package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SaveInterviewResultCommand {
    private final String interviewId;
    private final String userId;
    private final String userAnswer;
    private final String aiAnswer;
}
