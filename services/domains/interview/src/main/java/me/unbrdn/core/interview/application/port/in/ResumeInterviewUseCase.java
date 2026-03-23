package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

/** Use Case for resuming an interview */
public interface ResumeInterviewUseCase {
    ResumeInterviewResult execute(ResumeInterviewCommand command);

    record ResumeInterviewCommand(UUID interviewId) {}

    record ResumeInterviewResult(String interviewId, String status, String resumedAt) {}
}
