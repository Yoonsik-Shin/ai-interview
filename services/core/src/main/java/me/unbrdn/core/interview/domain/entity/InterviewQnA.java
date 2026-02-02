package me.unbrdn.core.interview.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
        name = "interview_qna",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"interview_id", "turn_number"})})
@Getter
@NoArgsConstructor
public class InterviewQnA extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_id", nullable = false)
    private InterviewSession interview;

    @Column(name = "turn_number", nullable = false)
    private Integer turnNumber;

    @Lob
    @Column(name = "question_text", nullable = false)
    private String questionText;

    @Lob
    @Column(name = "answer_text")
    private String answerText;

    @Lob
    @Column(name = "stt_text")
    private String sttText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "analysis_data", columnDefinition = "JSON")
    private Map<String, Object> analysisData;

    @Column(name = "media_url")
    private String mediaUrl;

    public InterviewQnA(
            InterviewSession interviewSession, Integer turnNumber, String questionText) {
        this.interview = interviewSession;
        this.turnNumber = turnNumber;
        this.questionText = questionText;
    }

    public void updateAnswer(String answerText, String sttText) {
        this.answerText = answerText;
        this.sttText = sttText;
    }

    public void updateAnalysis(Map<String, Object> analysisData) {
        this.analysisData = analysisData;
    }
}
