package me.unbrdn.core.interview.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.out.SaveInterviewHistoryPort;
import me.unbrdn.core.interview.domain.entity.InterviewHistory;
import me.unbrdn.core.interview.domain.repository.InterviewHistoryRepository;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewHistoryPersistenceAdapter implements SaveInterviewHistoryPort {

    private final InterviewHistoryRepository interviewHistoryRepository;

    @Override
    public InterviewHistory save(InterviewHistory interviewHistory) {
        return interviewHistoryRepository.save(interviewHistory);
    }
}
