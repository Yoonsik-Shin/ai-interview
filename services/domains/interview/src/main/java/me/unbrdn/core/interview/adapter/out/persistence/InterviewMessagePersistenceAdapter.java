package me.unbrdn.core.interview.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewSessionJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewMessageJpaRepository;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewSessionJpaRepository;
import me.unbrdn.core.interview.application.port.out.SaveInterviewMessagePort;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewMessagePersistenceAdapter implements SaveInterviewMessagePort {
    private final InterviewMessageJpaRepository repository;
    private final InterviewSessionJpaRepository sessionRepository;

    @Override
    public InterviewMessage save(InterviewMessage message) {
        // 1. 세션 조회 (InterviewSessionJpaEntity)
        InterviewSessionJpaEntity session =
                sessionRepository
                        .findById(message.getInterview().getId())
                        .orElseThrow(
                                () -> new IllegalArgumentException("Interview Session not found"));

        // 2. 도메인 -> JpaEntity 변환
        InterviewMessageJpaEntity jpaEntity =
                InterviewMessageJpaEntity.fromDomain(message, session);

        // 3. 저장 및 반환
        return repository.save(jpaEntity).toDomain();
    }
}
