package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.domain.entity.InterviewHistory;

public interface SaveInterviewHistoryPort {
    InterviewHistory save(InterviewHistory interviewHistory);
}
