package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewReportsJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewReportsJpaRepository
        extends JpaRepository<InterviewReportsJpaEntity, UUID> {
    Optional<InterviewReportsJpaEntity> findByInterviewId(UUID interviewId);
}
