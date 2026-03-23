package me.unbrdn.core.interview.application.port.out;

import java.util.Map;

public interface ProduceInterviewEventPort {
    void produceMessage(
            String interviewId,
            String role,
            String type,
            String content,
            Map<String, Object> payload);

    default void publishInterviewPaused(String interviewId) {
        produceMessage(interviewId, "SYSTEM", "INTERVIEW_PAUSED", "Interview paused", Map.of());
    }

    default void publishInterviewResumed(String interviewId) {
        produceMessage(interviewId, "SYSTEM", "INTERVIEW_RESUMED", "Interview resumed", Map.of());
    }
}
