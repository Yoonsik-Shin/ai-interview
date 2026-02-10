package me.unbrdn.core.interview.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "interview_reports")
@Getter
@NoArgsConstructor
public class InterviewReports extends BaseTimeEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_id", nullable = false, unique = true)
    private InterviewSession interview;

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
    @Column(name = "detail_metrics", columnDefinition = "JSON")
    private Map<String, Object> detailMetrics;

    private InterviewReports(
            InterviewSession interviewSession, Integer totalScore, PassFailStatus passFailStatus) {
        this.interview = interviewSession;
        this.totalScore = totalScore;
        this.passFailStatus = passFailStatus;
    }

    public static InterviewReports create(InterviewSession interviewSession, Integer totalScore) {
        return new InterviewReports(interviewSession, totalScore, PassFailStatus.HOLD);
    }

    public static InterviewReports create(
            InterviewSession interviewSession, Integer totalScore, PassFailStatus passFailStatus) {
        return new InterviewReports(interviewSession, totalScore, passFailStatus);
    }
}
