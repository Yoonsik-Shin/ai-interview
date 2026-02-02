package me.unbrdn.core.user.domain.entity;

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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.reference.domain.JobField;

/**
 * 면접자 희망 직무분야 엔티티 (Many-to-Many 중간 테이블)
 *
 * <p>Snapshot: candidate_desire_job_field 테이블 - candidate_id (PK, FK to candidate) - job_field_id
 * (PK, FK to job_field) - created_at: 등록일시
 *
 * <p>비즈니스 규칙: - 면접자는 여러 개의 희망 직무분야를 가질 수 있음 - 면접 시 이 정보를 참고하여 맞춤형 질문 생성
 *
 * <p>복합키(@EmbeddedId)를 사용하므로 BaseEntity를 상속받지 않음
 */
@Entity
@Table(name = "candidate_desire_job_field")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CandidateDesireJobField {

    @EmbeddedId private CandidateDesireJobFieldId id;

    @MapsId("candidateId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @MapsId("jobFieldId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_field_id", nullable = false)
    private JobField jobField;

    private CandidateDesireJobField(Candidate candidate, JobField jobField) {
        this.id = new CandidateDesireJobFieldId(candidate.getId(), jobField.getId());
        this.candidate = candidate;
        this.jobField = jobField;
    }

    /** 새로운 희망 직무분야 매핑 생성 */
    public static CandidateDesireJobField create(Candidate candidate, JobField jobField) {
        return new CandidateDesireJobField(candidate, jobField);
    }

    /** 복합키 클래스 */
    @Embeddable
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class CandidateDesireJobFieldId implements Serializable {
        @Column(name = "candidate_id", columnDefinition = "uuid")
        private java.util.UUID candidateId;

        @Column(name = "job_field_id", columnDefinition = "uuid")
        private java.util.UUID jobFieldId;
    }
}
