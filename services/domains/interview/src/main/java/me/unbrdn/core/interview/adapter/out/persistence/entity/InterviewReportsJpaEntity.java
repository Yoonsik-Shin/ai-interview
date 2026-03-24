package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;
import me.unbrdn.core.interview.domain.enums.ReportGenerationStatus;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "interview_reports")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewReportsJpaEntity extends BaseTimeJpaEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_id", nullable = false, unique = true)
    private InterviewSessionJpaEntity interview;

    @Enumerated(EnumType.STRING)
    @Column(name = "generation_status", nullable = false, length = 20)
    private ReportGenerationStatus generationStatus;

    @Column(name = "total_score", nullable = false)
    private Integer totalScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "pass_fail_status", nullable = false, length = 10)
    private PassFailStatus passFailStatus;

    @Column(name = "summary_text", columnDefinition = "TEXT")
    private String summaryText;

    @Column(name = "resume_feedback", columnDefinition = "TEXT")
    private String resumeFeedback;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail_metrics", columnDefinition = "JSONB")
    private Map<String, Object> detailMetrics;
}
