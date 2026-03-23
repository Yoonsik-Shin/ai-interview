package me.unbrdn.core.interview.adapter.out.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewSessionJpaRepository;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class InterviewPersistenceAdapter implements InterviewPort {

    private final InterviewSessionJpaRepository interviewRepository;
    private final InterviewMapper interviewMapper;

    @Override
    @Transactional
    public InterviewSession save(InterviewSession interviewSession) {
        var jpaEntity = interviewMapper.toJpaEntity(interviewSession);
        var savedEntity = interviewRepository.save(jpaEntity);
        return interviewMapper.toDomain(savedEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<InterviewSession> loadById(UUID interviewId) {
        return interviewRepository.findById(interviewId).map(interviewMapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InterviewSession> findByCandidateId(UUID candidateId) {
        return interviewRepository.findByCandidateIdOrderByStartedAtDesc(candidateId).stream()
                .map(interviewMapper::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InterviewSession> findAllByUserIdAndStatus(
            UUID candidateId, List<InterviewSessionStatus> statuses, int limit) {
        Pageable pageable = limit > 0 ? PageRequest.of(0, limit) : Pageable.unpaged();
        return interviewRepository
                .findByCandidateIdAndStatusInOrderByStartedAtDesc(candidateId, statuses, pageable)
                .stream()
                .map(interviewMapper::toDomain)
                .toList();
    }
}
