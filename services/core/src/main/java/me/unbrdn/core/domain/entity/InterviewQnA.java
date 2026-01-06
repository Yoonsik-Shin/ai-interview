package me.unbrdn.core.domain.entity;

import java.time.LocalDateTime;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interview_qna", uniqueConstraints = {
    @UniqueConstraint(columnNames = { "interview_id", "turn_number" }) })
@Getter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class InterviewQnA {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "qna_id")
  private Long qnaId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "interview_id", nullable = false)
  private Interviews interview;

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

  @CreatedDate
  @Column(name = "created_at", updatable = false)
  private LocalDateTime createdAt;

  public InterviewQnA(Interviews interview, Integer turnNumber, String questionText) {
    this.interview = interview;
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