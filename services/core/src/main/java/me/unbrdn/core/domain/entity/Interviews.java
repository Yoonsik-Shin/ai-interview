package me.unbrdn.core.domain.entity;

import java.time.LocalDateTime;

import me.unbrdn.core.domain.enums.InterviewPersona;
import me.unbrdn.core.domain.enums.InterviewStatus;
import me.unbrdn.core.domain.enums.InterviewType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interviews")
@Getter
@NoArgsConstructor
public class Interviews {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "interview_id")
  private Long interviewId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private Users user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "resume_id", nullable = false)
  private Resumes resume;

  @Column(nullable = false, length = 50)
  private String domain;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private InterviewType type;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private InterviewStatus status;

  @Lob
  @Column(name = "self_introduction")
  private String selfIntroduction;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private InterviewPersona persona;

  @Column(name = "interviewer_count", nullable = false)
  private Integer interviewerCount;

  @Column(name = "target_duration_minutes", nullable = false)
  private Integer targetDurationMinutes;

  @Column(name = "started_at")
  private LocalDateTime startedAt;

  @Column(name = "ended_at")
  private LocalDateTime endedAt;

  @Builder
  public Interviews(Users user, Resumes resume, String domain, InterviewType type, InterviewStatus status,
      String selfIntroduction, InterviewPersona persona, Integer interviewerCount, Integer targetDurationMinutes) {
    this.user = user;
    this.resume = resume;
    this.domain = domain;
    this.type = type;
    this.status = status;
    this.selfIntroduction = selfIntroduction;
    this.persona = persona;
    this.interviewerCount = interviewerCount;
    this.targetDurationMinutes = targetDurationMinutes;
  }

  public void startInterview() {
    this.status = InterviewStatus.IN_PROGRESS;
    this.startedAt = LocalDateTime.now();
  }

  public void finishInterview() {
    this.status = InterviewStatus.COMPLETED;
    this.endedAt = LocalDateTime.now();
  }

  public static Interviews create(Users user, Resumes resume, String domain, InterviewType type, InterviewStatus status,
      String selfIntroduction, InterviewPersona persona, Integer interviewerCount, Integer targetDurationMinutes) {
    return new Interviews(user, resume, domain, type, status, selfIntroduction, persona, interviewerCount,
        targetDurationMinutes);
  }
}