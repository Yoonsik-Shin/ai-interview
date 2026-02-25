package me.unbrdn.core.interview.domain.entity;

import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewQnA extends BaseTimeEntity {

    private InterviewSession interview;
    private Integer turnNumber;
    private String questionText;
    private String answerText;
    private String sttText;
    private Map<String, Object> analysisData;
    private String mediaUrl;

    public static InterviewQnA create(
            InterviewSession interview, Integer turnNumber, String questionText) {
        return InterviewQnA.builder()
                .interview(interview)
                .turnNumber(turnNumber)
                .questionText(questionText)
                .build();
    }

    public void updateAnswer(String answerText, String sttText) {
        this.answerText = answerText;
        this.sttText = sttText;
    }

    public void updateAnalysis(Map<String, Object> analysisData) {
        this.analysisData = analysisData;
    }
}
