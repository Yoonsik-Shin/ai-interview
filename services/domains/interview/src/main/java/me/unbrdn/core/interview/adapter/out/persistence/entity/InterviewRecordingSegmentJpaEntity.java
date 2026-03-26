package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;
import me.unbrdn.core.interview.domain.enums.SegmentAnalysisStatus;

@Entity
@Table(name = "interview_recording_segments")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewRecordingSegmentJpaEntity extends BaseTimeJpaEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_session_id", nullable = false)
    private InterviewSessionJpaEntity interviewSession;

    @Column(name = "turn_count", nullable = false)
    private Integer turnCount;

    @Column(name = "object_key", nullable = false, length = 1024)
    private String objectKey;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "analysis_status", nullable = false, length = 20)
    private SegmentAnalysisStatus analysisStatus;

    public static InterviewRecordingSegmentJpaEntity fromDomain(
            InterviewRecordingSegment segment, InterviewSessionJpaEntity session) {
        return InterviewRecordingSegmentJpaEntity.builder()
                .id(segment.getId())
                .interviewSession(session)
                .turnCount(segment.getTurnCount())
                .objectKey(segment.getObjectKey())
                .durationSeconds(segment.getDurationSeconds())
                .startedAt(segment.getStartedAt())
                .endedAt(segment.getEndedAt())
                .analysisStatus(segment.getAnalysisStatus())
                .createdAt(segment.getCreatedAt())
                .updatedAt(segment.getUpdatedAt())
                .build();
    }

    public InterviewRecordingSegment toDomain() {
        return InterviewRecordingSegment.builder()
                .id(this.getId())
                .turnCount(this.turnCount)
                .objectKey(this.objectKey)
                .durationSeconds(this.durationSeconds)
                .startedAt(this.startedAt)
                .endedAt(this.endedAt)
                .analysisStatus(this.analysisStatus)
                .createdAt(this.getCreatedAt())
                .updatedAt(this.getUpdatedAt())
                .build();
    }
}
