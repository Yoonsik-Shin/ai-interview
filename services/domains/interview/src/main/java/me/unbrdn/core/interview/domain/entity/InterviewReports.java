package me.unbrdn.core.interview.domain.entity;

import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewReports extends BaseTimeEntity {

    private InterviewSession interview;
    private Integer totalScore;
    private PassFailStatus passFailStatus;
    private String summaryText;
    private String resumeFeedback;
    private Map<String, Object> detailMetrics;

    public static InterviewReports create(InterviewSession interviewSession, Integer totalScore) {
        return InterviewReports.builder()
                .interview(interviewSession)
                .totalScore(totalScore)
                .passFailStatus(PassFailStatus.HOLD)
                .build();
    }

    public static InterviewReports create(
            InterviewSession interviewSession, Integer totalScore, PassFailStatus passFailStatus) {
        return InterviewReports.builder()
                .interview(interviewSession)
                .totalScore(totalScore)
                .passFailStatus(passFailStatus)
                .build();
    }
}
