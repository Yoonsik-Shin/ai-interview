package me.unbrdn.core.interview.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.repository.InterviewSessionRepository;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewPersistenceAdapter implements InterviewPort {

    private final InterviewSessionRepository interviewRepository;

    @Override
    public InterviewSession save(InterviewSession interviewSession) {
        return interviewRepository.save(interviewSession);
    }

    @Override
    public Optional<InterviewSession> loadById(UUID interviewId) {
        return interviewRepository.findById(interviewId);
    }
}
