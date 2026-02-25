package me.unbrdn.core.user.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.reference.adapter.out.persistence.entity.JobFieldJpaEntity;

/**
 * 면접자 희망 직무분야 엔티티 (Many-to-Many 중간 테이블)
 *
 * <p>복합키 클래스 CandidateDesireJobFieldId를 사용함
 */
@Entity
@Table(name = "candidate_desire_job_field")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CandidateDesireJobFieldJpaEntity {

    @EmbeddedId private CandidateDesireJobFieldId id;

    @MapsId("candidateId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private CandidateJpaEntity candidate;

    @MapsId("jobFieldId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_field_id", nullable = false)
    private JobFieldJpaEntity jobField;

    @Embeddable
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class CandidateDesireJobFieldId implements Serializable {
        @Column(name = "candidate_id")
        private UUID candidateId;

        @Column(name = "job_field_id")
        private UUID jobFieldId;
    }
}
