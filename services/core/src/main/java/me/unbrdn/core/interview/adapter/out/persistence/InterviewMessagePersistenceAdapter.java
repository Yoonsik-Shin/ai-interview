package me.unbrdn.core.interview.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewMessageJpaRepository;
import me.unbrdn.core.interview.application.port.out.SaveInterviewMessagePort;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewMessagePersistenceAdapter implements SaveInterviewMessagePort {
    private final InterviewMessageJpaRepository repository;

    @Override
    public InterviewMessage save(InterviewMessage message) {
        return repository.save(message);
    }
}
