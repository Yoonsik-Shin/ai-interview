package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewMessageJpaRepository extends JpaRepository<InterviewMessageJpaEntity, UUID> {

    List<InterviewMessageJpaEntity> findByInterview_IdOrderByCreatedAtAsc(UUID interviewId);
}
