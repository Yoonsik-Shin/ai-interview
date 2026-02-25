package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.domain.entity.InterviewQnA;

public interface SaveInterviewQnAPort {
    void save(InterviewQnA qna);
}
