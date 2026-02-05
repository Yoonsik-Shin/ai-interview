package me.unbrdn.core.interview.domain.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.user.domain.entity.Candidate;
import jakarta.persistence.*;

@Entity
@Table(name = "interview_session")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewSession extends BaseTimeEntity {

    /**
     * MongoDB에서 동일한 세션을 참조할 수 있도록 UUID 문자열 사용 향후 마이그레이션: PK를 String(UUID)로 변경 권장
     */
    @Column(name = "session_uuid", nullable = false, unique = true, length = 36)
    private String sessionUuid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id")
    private Resumes resume;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "interview_session_roles", joinColumns = @JoinColumn(name = "interview_session_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role")
    private List<InterviewRole> roles = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewPersonality personality;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewSessionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewStage stage;

    @Column(name = "self_intro_start_time")
    private LocalDateTime selfIntroStartTime;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(nullable = false, length = 100)
    private String domain;

    @Column(name = "interviewer_count", nullable = false)
    private int interviewerCount;

    @Column(name = "target_duration_minutes", nullable = false)
    private int targetDurationMinutes;

    @Column(columnDefinition = "TEXT")
    private String selfIntroduction;

    @Column(name = "current_difficulty", nullable = false)
    private int currentDifficulty;

    @Column(name = "last_interviewer_id")
    private String lastInterviewerId;

    private InterviewSession(String sessionUuid, Candidate candidate, Resumes resume, List<InterviewRole> roles,
            InterviewPersonality personality, InterviewType type, String domain, int interviewerCount,
            int targetDurationMinutes, String selfIntroduction) {
        this.sessionUuid = sessionUuid;
        this.candidate = candidate;
        this.resume = resume;
        this.roles = roles;
        this.personality = personality;
        this.type = type;
        this.domain = domain;
        this.interviewerCount = interviewerCount;
        this.targetDurationMinutes = targetDurationMinutes;
        this.selfIntroduction = selfIntroduction;
        this.status = InterviewSessionStatus.READY;
        this.stage = InterviewStage.WAITING;
        // Initialize State
        this.currentDifficulty = 3; // Default Medium
        this.lastInterviewerId = "MAIN"; // Default Start (Need update later e.g. TECH)
    }

    /** 새로운 면접 세션 생성 */
    public static InterviewSession create(String sessionUuid, Candidate candidate, Resumes resume,
            List<InterviewRole> roles, InterviewPersonality personality, InterviewType type, String domain,
            int interviewerCount, int targetDurationMinutes, String selfIntroduction) {
        return new InterviewSession(sessionUuid, candidate, resume, roles, personality, type, domain, interviewerCount,
                targetDurationMinutes, selfIntroduction);
    }

    /** 면접 시작 */
    public void start() {
        if (this.status != InterviewSessionStatus.READY) {
            throw new IllegalStateException("READY 상태에서만 면접을 시작할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.IN_PROGRESS;
        this.startedAt = LocalDateTime.now();
    }

    /** 면접 완료 */
    public void complete() {
        if (this.status != InterviewSessionStatus.IN_PROGRESS) {
            throw new IllegalStateException("IN_PROGRESS 상태에서만 면접을 완료할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.COMPLETED;
        this.endedAt = LocalDateTime.now();
    }

    /** 면접 취소 */
    public void cancel() {
        if (this.status == InterviewSessionStatus.COMPLETED) {
            throw new IllegalStateException("이미 완료된 면접은 취소할 수 없습니다.");
        }
        this.status = InterviewSessionStatus.CANCELLED;
        this.endedAt = LocalDateTime.now();
    }

    /** 면접 진행 중 여부 확인 */
    public boolean isInProgress() {
        return this.status == InterviewSessionStatus.IN_PROGRESS;
    }

    /** 면접 완료 여부 확인 */
    public boolean isCompleted() {
        return this.status == InterviewSessionStatus.COMPLETED;
    }

    // ==================== Stage Transition Methods ====================

    /** WAITING → GREETING (면접관 인사) */
    public void transitionToGreeting() {
        if (this.stage != InterviewStage.WAITING) {
            throw new IllegalStateException(
                    "Can only transition to GREETING from WAITING, current stage: " + this.stage);
        }
        this.stage = InterviewStage.GREETING;
    }

    /** GREETING → CANDIDATE_GREETING (면접자 인사) */
    public void transitionToCandidateGreeting() {
        if (this.stage != InterviewStage.GREETING) {
            throw new IllegalStateException(
                    "Can only transition to CANDIDATE_GREETING from GREETING, current stage: " + this.stage);
        }
        this.stage = InterviewStage.CANDIDATE_GREETING;
    }

    /** CANDIDATE_GREETING → INTERVIEWER_INTRO (면접관 자기소개) */
    public void transitionToInterviewerIntro() {
        if (this.stage != InterviewStage.CANDIDATE_GREETING) {
            throw new IllegalStateException(
                    "Can only transition to INTERVIEWER_INTRO from CANDIDATE_GREETING, current stage: " + this.stage);
        }
        this.stage = InterviewStage.INTERVIEWER_INTRO;
    }

    /** INTERVIEWER_INTRO → SELF_INTRO_PROMPT (1분 자기소개 요청) */
    public void transitionToSelfIntroPrompt() {
        if (this.stage != InterviewStage.INTERVIEWER_INTRO) {
            throw new IllegalStateException(
                    "Can only transition to SELF_INTRO_PROMPT from INTERVIEWER_INTRO, current stage: " + this.stage);
        }
        this.stage = InterviewStage.SELF_INTRO_PROMPT;
    }

    /** SELF_INTRO_PROMPT → SELF_INTRO (면접자 1분 자기소개) */
    public void transitionToSelfIntro() {
        if (this.stage != InterviewStage.SELF_INTRO_PROMPT && this.stage != InterviewStage.SELF_INTRO) {
            throw new IllegalStateException(
                    "Can only transition to SELF_INTRO from SELF_INTRO_PROMPT or SELF_INTRO, current stage: "
                            + this.stage);
        }
        this.stage = InterviewStage.SELF_INTRO;
        this.selfIntroStartTime = LocalDateTime.now();
    }

    /** SELF_INTRO → IN_PROGRESS (본 면접 진행) */
    public void transitionToInProgress() {
        if (this.stage != InterviewStage.SELF_INTRO) {
            throw new IllegalStateException(
                    "Can only transition to IN_PROGRESS from SELF_INTRO, current stage: " + this.stage);
        }
        this.stage = InterviewStage.IN_PROGRESS;
        if (this.status == InterviewSessionStatus.READY) {
            this.status = InterviewSessionStatus.IN_PROGRESS;
            this.startedAt = LocalDateTime.now();
        }
    }

    /** IN_PROGRESS → LAST_QUESTION_PROMPT (마지막 질문 안내) */
    public void transitionToLastQuestionPrompt() {
        if (this.stage != InterviewStage.IN_PROGRESS) {
            throw new IllegalStateException(
                    "Can only transition to LAST_QUESTION_PROMPT from IN_PROGRESS, current stage: " + this.stage);
        }
        this.stage = InterviewStage.LAST_QUESTION_PROMPT;
    }

    /** LAST_QUESTION_PROMPT → LAST_ANSWER (지원자 마지막 답변) */
    public void transitionToLastAnswer() {
        if (this.stage != InterviewStage.LAST_QUESTION_PROMPT) {
            throw new IllegalStateException(
                    "Can only transition to LAST_ANSWER from LAST_QUESTION_PROMPT, current stage: " + this.stage);
        }
        this.stage = InterviewStage.LAST_ANSWER;
    }

    /** LAST_ANSWER → COMPLETED */
    public void transitionToCompleted() {
        // Allow transition from LAST_ANSWER or IN_PROGRESS (legacy/fallback)
        if (this.stage != InterviewStage.LAST_ANSWER && this.stage != InterviewStage.IN_PROGRESS) {
            throw new IllegalStateException(
                    "Can only transition to COMPLETED from LAST_ANSWER or IN_PROGRESS, current stage: " + this.stage);
        }
        this.stage = InterviewStage.COMPLETED;
        this.status = InterviewSessionStatus.COMPLETED;
        this.endedAt = LocalDateTime.now();
    }

    /** 자기소개 경과 시간 확인 (초 단위) */
    public long getSelfIntroElapsedSeconds() {
        if (this.selfIntroStartTime == null) {
            return 0;
        }
        return java.time.Duration.between(this.selfIntroStartTime, LocalDateTime.now()).getSeconds();
    }

    /** 자기소개 90초 경과 여부 */
    public boolean isSelfIntroTimeExceeded() {
        return getSelfIntroElapsedSeconds() >= 90;
    }

    // ==================== State Management Methods ====================

    public void updateDifficulty(int newDifficulty) {
        if (newDifficulty < 1)
            newDifficulty = 1;
        if (newDifficulty > 5)
            newDifficulty = 5;
        this.currentDifficulty = newDifficulty;
    }

    public void updateLastInterviewer(String lastInterviewerId) {
        this.lastInterviewerId = lastInterviewerId;
    }

    public void reduceTotalTime() {
        // Example: Reduce remaining time by 20% of original total?
        // Or simply mark it. The Requirement said "Reduce total time by 20%".
        // Implementation: We might store 'effective_duration_minutes'.
        this.targetDurationMinutes = (int) (this.targetDurationMinutes * 0.8);
    }
}
