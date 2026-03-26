package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewRecordingSegmentJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewRecordingSegmentJpaRepository
        extends JpaRepository<InterviewRecordingSegmentJpaEntity, UUID> {

    List<InterviewRecordingSegmentJpaEntity> findByInterviewSessionIdOrderByTurnCount(
            UUID interviewSessionId);
}
