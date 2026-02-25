package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
        name = "interview_qna",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"interview_id", "turn_number"})})
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewQnAJpaEntity extends BaseTimeJpaEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_id", nullable = false)
    private InterviewSessionJpaEntity interview;

    @Column(name = "turn_number", nullable = false)
    private Integer turnNumber;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "stt_text", columnDefinition = "TEXT")
    private String sttText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "analysis_data", columnDefinition = "JSONB")
    private Map<String, Object> analysisData;

    @Column(name = "media_url")
    private String mediaUrl;
}
