package me.unbrdn.core.interview.application.port.out;

import java.util.List;
import me.unbrdn.core.interview.adapter.out.mongodb.entity.InterviewMessageDocument;

/** Output Port for loading interview history from MongoDB */
public interface LoadInterviewHistoryPort {

    /**
     * Load all messages for a specific interview
     *
     * @param interviewId the interview ID
     * @return list of interview messages in chronological order
     */
    List<InterviewMessageDocument> loadHistory(String interviewId);
}
