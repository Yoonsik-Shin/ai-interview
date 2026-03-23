package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

/** Use Case for completing an interview */
public interface CompleteInterviewUseCase {
    CompleteInterviewResult execute(CompleteInterviewCommand command);

    record CompleteInterviewCommand(UUID interviewId) {}

    record CompleteInterviewResult(String interviewId, String status, String endedAt) {}
}
