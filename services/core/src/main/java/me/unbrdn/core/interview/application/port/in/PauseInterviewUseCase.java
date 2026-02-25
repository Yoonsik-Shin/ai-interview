package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

/** Use Case for pausing an interview */
public interface PauseInterviewUseCase {
    PauseInterviewResult execute(PauseInterviewCommand command);

    record PauseInterviewCommand(UUID interviewId) {}

    record PauseInterviewResult(String interviewId, String status, String pausedAt) {}
}
