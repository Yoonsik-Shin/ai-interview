package me.unbrdn.core.interview.application.interactor;

import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewStateSnapshotJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewStateSnapshotRepository;
import me.unbrdn.core.interview.application.event.SessionStateUpdatedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecordStateSnapshotListener {

    private final InterviewStateSnapshotRepository snapshotRepository;

    @Async
    @EventListener
    @Transactional
    public void handleSessionStateUpdated(SessionStateUpdatedEvent event) {
        log.info(
                "Recording InterviewSessionState snapshot for interview: {}",
                event.getInterviewId());

        try {
            InterviewStateSnapshotJpaEntity snapshot =
                    InterviewStateSnapshotJpaEntity.builder()
                            .id(UUID.randomUUID())
                            .interviewSessionId(UUID.fromString(event.getInterviewId()))
                            .stateJson(event.getState()) // Handled via JdbcTypeCode mapping
                            .createdAt(Instant.now())
                            .build();

            snapshotRepository.save(snapshot);
        } catch (Exception e) {
            log.error(
                    "Failed to record state snapshot for interview: {}", event.getInterviewId(), e);
        }
    }
}
