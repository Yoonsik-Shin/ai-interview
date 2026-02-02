package me.unbrdn.core.interview.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interview_results")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "interview_id", nullable = false)
    private String interviewId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_answer", columnDefinition = "TEXT")
    private String userAnswer;

    @Column(name = "ai_answer", columnDefinition = "TEXT")
    private String aiAnswer;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
