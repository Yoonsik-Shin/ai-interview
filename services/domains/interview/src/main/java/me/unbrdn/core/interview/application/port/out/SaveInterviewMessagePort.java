package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.domain.entity.InterviewMessage;

public interface SaveInterviewMessagePort {
    InterviewMessage save(InterviewMessage message);
}
