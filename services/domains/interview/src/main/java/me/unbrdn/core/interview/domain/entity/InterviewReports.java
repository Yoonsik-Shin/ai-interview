package me.unbrdn.core.interview.domain.entity;

import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;
import me.unbrdn.core.interview.domain.enums.ReportGenerationStatus;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewReports extends BaseTimeEntity {

    private InterviewSession interview;
    private ReportGenerationStatus generationStatus;
    private Integer totalScore;
    private PassFailStatus passFailStatus;
    private String summaryText;
    private String resumeFeedback;
    private Map<String, Object> detailMetrics;

    public static InterviewReports pending(InterviewSession interviewSession) {
        return InterviewReports.builder()
                .interview(interviewSession)
                .generationStatus(ReportGenerationStatus.PENDING)
                .totalScore(0)
                .passFailStatus(PassFailStatus.HOLD)
                .build();
    }

    public void complete(Integer score, PassFailStatus status, String summary, String feedback) {
        this.generationStatus = ReportGenerationStatus.COMPLETED;
        this.totalScore = score;
        this.passFailStatus = status;
        this.summaryText = summary;
        this.resumeFeedback = feedback;
    }

    public void fail() {
        this.generationStatus = ReportGenerationStatus.FAILED;
    }

    public static InterviewReports create(InterviewSession interviewSession, Integer totalScore) {
        return InterviewReports.builder()
                .interview(interviewSession)
                .generationStatus(ReportGenerationStatus.COMPLETED)
                .totalScore(totalScore)
                .passFailStatus(PassFailStatus.HOLD)
                .build();
    }

    public static InterviewReports create(
            InterviewSession interviewSession, Integer totalScore, PassFailStatus passFailStatus) {
        return InterviewReports.builder()
                .interview(interviewSession)
                .generationStatus(ReportGenerationStatus.COMPLETED)
                .totalScore(totalScore)
                .passFailStatus(passFailStatus)
                .build();
    }
}
