package me.unbrdn.core.interview.adapter.out.persistence;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewRecordingSegmentJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewSessionJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewRecordingSegmentJpaRepository;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewSessionJpaRepository;
import me.unbrdn.core.interview.application.port.out.LoadRecordingSegmentsPort;
import me.unbrdn.core.interview.application.port.out.SaveRecordingSegmentPort;
import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewRecordingSegmentPersistenceAdapter
        implements SaveRecordingSegmentPort, LoadRecordingSegmentsPort {

    private final InterviewRecordingSegmentJpaRepository repository;
    private final InterviewSessionJpaRepository sessionRepository;

    @Override
    public InterviewRecordingSegment save(InterviewRecordingSegment segment) {
        InterviewSessionJpaEntity session =
                sessionRepository
                        .findById(segment.getInterviewSession().getId())
                        .orElseThrow(() -> new IllegalArgumentException("Interview Session not found"));

        InterviewRecordingSegmentJpaEntity jpaEntity =
                InterviewRecordingSegmentJpaEntity.fromDomain(segment, session);

        return repository.save(jpaEntity).toDomain();
    }

    @Override
    public List<InterviewRecordingSegment> loadByInterviewSessionId(UUID interviewSessionId) {
        return repository
                .findByInterviewSessionIdOrderByTurnCount(interviewSessionId)
                .stream()
                .map(InterviewRecordingSegmentJpaEntity::toDomain)
                .toList();
    }
}
