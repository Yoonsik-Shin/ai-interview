package me.unbrdn.core.interview.application.event;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class InterviewerIntroFinishedEvent {
    private final String interviewId;
    private final String interviewSessionId;
    private final String userId;
    private final String mode;
}
