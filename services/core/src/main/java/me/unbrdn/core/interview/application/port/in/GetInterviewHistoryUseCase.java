package me.unbrdn.core.interview.application.port.in;

import java.util.List;

/** Use Case for retrieving interview history */
public interface GetInterviewHistoryUseCase {

    /**
     * Get interview message history
     *
     * @param interviewId the interview ID
     * @return list of interview messages
     */
    List<InterviewMessageDto> execute(String interviewId);

    /** DTO for interview message */
    record InterviewMessageDto(
            String role,
            String type,
            String content,
            String timestamp,
            java.util.Map<String, String> payload) {}
}
