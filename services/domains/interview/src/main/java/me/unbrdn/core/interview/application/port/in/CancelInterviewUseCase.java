package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

/** Use Case for cancelling an interview */
public interface CancelInterviewUseCase {
    CancelInterviewResult execute(CancelInterviewCommand command);

    record CancelInterviewCommand(UUID interviewId, String reason) {}

    record CancelInterviewResult(String interviewId, String status, String endedAt) {}
}
