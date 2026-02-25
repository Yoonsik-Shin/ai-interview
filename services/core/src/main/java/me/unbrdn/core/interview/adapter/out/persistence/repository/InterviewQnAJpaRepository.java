package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewQnAJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewQnAJpaRepository extends JpaRepository<InterviewQnAJpaEntity, UUID> {
    List<InterviewQnAJpaEntity> findByInterviewIdOrderByTurnNumberAsc(UUID interviewId);
}
