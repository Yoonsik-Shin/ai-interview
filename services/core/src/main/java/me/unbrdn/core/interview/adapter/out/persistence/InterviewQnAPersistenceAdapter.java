package me.unbrdn.core.interview.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewQnAJpaRepository;
import me.unbrdn.core.interview.application.port.out.SaveInterviewQnAPort;
import me.unbrdn.core.interview.domain.entity.InterviewQnA;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewQnAPersistenceAdapter implements SaveInterviewQnAPort {

    private final InterviewQnAJpaRepository repository;
    private final InterviewMapper mapper;

    @Override
    public void save(InterviewQnA qna) {
        repository.save(mapper.toJpaEntity(qna));
    }
}
