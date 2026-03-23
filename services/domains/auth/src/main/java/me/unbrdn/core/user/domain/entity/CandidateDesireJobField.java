package me.unbrdn.core.user.domain.entity;

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
 * <p>복합키 클래스 CandidateDesireJobFieldId를 사용함
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CandidateDesireJobField {

    private CandidateDesireJobFieldId id;

    private Candidate candidate;

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
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class CandidateDesireJobFieldId implements Serializable {
        private java.util.UUID candidateId;
        private java.util.UUID jobFieldId;
    }
}
