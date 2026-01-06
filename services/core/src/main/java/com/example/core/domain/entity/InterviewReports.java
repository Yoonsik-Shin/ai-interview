package com.example.core.domain.entity;

import java.time.LocalDateTime;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.example.core.domain.enums.PassFailStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interview_reports")
@Getter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class InterviewReports {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "report_id")
  private Long reportId;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "interview_id", nullable = false, unique = true)
  private Interviews interview;

  @Column(name = "total_score", nullable = false)
  private Integer totalScore;

  @Enumerated(EnumType.STRING)
  @Column(name = "pass_fail_status", nullable = false, length = 10)
  private PassFailStatus passFailStatus;

  @Lob
  @Column(name = "summary_text")
  private String summaryText;

  @Lob
  @Column(name = "resume_feedback")
  private String resumeFeedback;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "detail_metrics", columnDefinition = "JSON")
  private Map<String, Object> detailMetrics;

  @CreatedDate
  @Column(name = "created_at", updatable = false)
  private LocalDateTime createdAt;

  private InterviewReports(Interviews interview, Integer totalScore, PassFailStatus passFailStatus) {
    this.interview = interview;
    this.totalScore = totalScore;
    this.passFailStatus = passFailStatus;
  }

  public static InterviewReports create(Interviews interview, Integer totalScore) {
    return new InterviewReports(interview, totalScore, PassFailStatus.HOLD);
  }

  public static InterviewReports create(Interviews interview, Integer totalScore, PassFailStatus passFailStatus) {
    return new InterviewReports(interview, totalScore, passFailStatus);
  }
}