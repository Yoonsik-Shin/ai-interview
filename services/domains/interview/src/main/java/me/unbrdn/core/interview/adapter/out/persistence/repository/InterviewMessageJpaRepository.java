package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewMessageJpaRepository
        extends JpaRepository<InterviewMessageJpaEntity, UUID> {

    List<InterviewMessageJpaEntity> findByInterview_IdOrderByCreatedAtAsc(UUID interviewId);

    Optional<InterviewMessageJpaEntity> findByInterview_IdAndTurnCountAndSequenceNumberAndRole(
            UUID interviewId, Integer turnCount, Integer sequenceNumber, MessageRole role);
}
