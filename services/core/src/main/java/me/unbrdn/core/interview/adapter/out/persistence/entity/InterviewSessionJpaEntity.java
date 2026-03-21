package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import me.unbrdn.core.resume.adapter.out.persistence.entity.ResumeJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.CandidateJpaEntity;

@Entity
@Table(name = "interview_session")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewSessionJpaEntity extends BaseTimeJpaEntity {

    @Column(name = "session_uuid", nullable = false, unique = true, length = 36)
    private String interviewId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private CandidateJpaEntity candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id")
    private ResumeJpaEntity resume;

    @Enumerated(EnumType.STRING)
    @Column(name = "personality", nullable = false, length = 20)
    private InterviewPersonality personality;

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

    @Column(name = "initial_target_duration_minutes", nullable = false)
    private int initialTargetDurationMinutes;

    @Column(name = "target_duration_minutes", nullable = false)
    private int targetDurationMinutes;

    @Column(columnDefinition = "TEXT")
    private String selfIntroduction;

    @Column(name = "turn_count", nullable = false)
    @Builder.Default
    private int turnCount = 0;

    @jakarta.persistence.Version
    @Column(name = "version")
    @Builder.Default
    private Long version = 0L;
}
