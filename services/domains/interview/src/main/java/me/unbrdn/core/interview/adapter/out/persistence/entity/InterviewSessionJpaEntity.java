package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;

@Entity
@Table(name = "interview_session")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewSessionJpaEntity extends BaseTimeJpaEntity {

    @Column(name = "candidate_id", nullable = false)
    private java.util.UUID candidateId;

    @Column(name = "resume_id")
    private java.util.UUID resumeId;

    @Column(name = "company_name")
    private String companyName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewSessionStatus status;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(nullable = false, length = 100)
    private String domain;

    @Column(name = "scheduled_duration_minutes", nullable = false)
    private int scheduledDurationMinutes;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "participating_personas", columnDefinition = "jsonb")
    private java.util.List<String> participatingPersonas;

    @Column(name = "turn_count", nullable = false)
    @Builder.Default
    private int turnCount = 0;

    @jakarta.persistence.Version
    @Column(name = "version")
    @Builder.Default
    private Long version = 0L;
}
