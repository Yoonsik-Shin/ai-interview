package me.unbrdn.core.interview.domain.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.user.domain.entity.Candidate;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewSession extends BaseTimeEntity {

    private Candidate candidate;
    private Resumes resume;

    @Builder.Default private List<InterviewRole> roles = new ArrayList<>();

    private InterviewPersonality personality;
    private InterviewType type;
    private InterviewSessionStatus status;
    private InterviewStage stage;
    private Instant selfIntroStartTime;
    private Instant startedAt;
    private Instant endedAt;
    private Instant pausedAt;
    private Instant resumedAt;
    private String domain;
    private int interviewerCount;
    private int initialTargetDurationMinutes;
    private int targetDurationMinutes;
    private String selfIntroduction;
    private int initialDifficulty;
    private int currentDifficulty;
    private String lastInterviewerId;
    private int turnCount;
    private Long version;

    public void start() {
        if (this.status != InterviewSessionStatus.READY) {
            throw new IllegalStateException("READY 상태에서만 면접을 시작할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.IN_PROGRESS;
        this.startedAt = Instant.now();
    }

    public void complete() {
        if (this.status == InterviewSessionStatus.COMPLETED) {
            return;
        }
        if (this.status == InterviewSessionStatus.CANCELLED) {
            throw new IllegalStateException("취소된 면접은 완료할 수 없습니다.");
        }
        this.status = InterviewSessionStatus.COMPLETED;
        this.endedAt = Instant.now();
    }

    public void cancel() {
        if (this.status == InterviewSessionStatus.COMPLETED) {
            throw new IllegalStateException("이미 완료된 면접은 취소할 수 없습니다.");
        }
        this.status = InterviewSessionStatus.CANCELLED;
        this.endedAt = Instant.now();
    }

    public void pause() {
        if (this.status != InterviewSessionStatus.IN_PROGRESS) {
            throw new IllegalStateException("진행 중인 면접만 중지할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.PAUSED;
        this.pausedAt = Instant.now();
    }

    public void resume() {
        if (this.status != InterviewSessionStatus.PAUSED) {
            throw new IllegalStateException("중지된 면접만 재개할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.IN_PROGRESS;
        this.resumedAt = Instant.now();
    }

    public boolean isInProgress() {
        return this.status == InterviewSessionStatus.IN_PROGRESS;
    }

    public boolean isCompleted() {
        return this.status == InterviewSessionStatus.COMPLETED;
    }

    private void ensureStarted() {
        if (this.status == InterviewSessionStatus.READY) {
            this.status = InterviewSessionStatus.IN_PROGRESS;
            this.startedAt = Instant.now();
        }
    }

    public void transitionToGreeting() {
        ensureStarted();
        this.stage = InterviewStage.GREETING;
    }

    public void transitionToCandidateGreeting() {
        ensureStarted();
        this.stage = InterviewStage.CANDIDATE_GREETING;
    }

    public void transitionToInterviewerIntro() {
        ensureStarted();
        this.stage = InterviewStage.INTERVIEWER_INTRO;
    }

    public void transitionToSelfIntroPrompt() {
        ensureStarted();
        this.stage = InterviewStage.SELF_INTRO_PROMPT;
    }

    public void transitionToSelfIntro() {
        ensureStarted();
        this.stage = InterviewStage.SELF_INTRO;
        this.selfIntroStartTime = Instant.now();
    }

    public void extendSelfIntroTime() {
        this.selfIntroStartTime = Instant.now();
    }

    public void transitionToInProgress() {
        ensureStarted();
        this.stage = InterviewStage.IN_PROGRESS;
    }

    public void transitionToLastQuestionPrompt() {
        ensureStarted();
        this.stage = InterviewStage.LAST_QUESTION_PROMPT;
    }

    public void transitionToLastAnswer() {
        ensureStarted();
        this.stage = InterviewStage.LAST_ANSWER;
    }

    public void transitionToClosingGreeting() {
        ensureStarted();
        this.stage = InterviewStage.CLOSING_GREETING;
    }

    public void transitionToCompleted() {
        this.stage = InterviewStage.COMPLETED;
        this.status = InterviewSessionStatus.COMPLETED;
        this.endedAt = Instant.now();
    }

    public long getSelfIntroElapsedSeconds() {
        if (this.selfIntroStartTime == null) return 0;
        return java.time.Duration.between(this.selfIntroStartTime, Instant.now()).getSeconds();
    }

    public boolean isSelfIntroTimeExceeded() {
        return getSelfIntroElapsedSeconds() >= 90;
    }

    public void updateDifficulty(int newDifficulty) {
        if (newDifficulty < 1) newDifficulty = 1;
        if (newDifficulty > 5) newDifficulty = 5;
        this.currentDifficulty = newDifficulty;
    }

    public void updateLastInterviewer(String lastInterviewerId) {
        this.lastInterviewerId = lastInterviewerId;
    }

    public InterviewStage getCurrentStage() {
        return this.stage;
    }

    /**
     * [DevTool] 면접 단계를 강제로 변경합니다. 개발 환경에서만 사용되며, 테스트 및 디버깅 목적입니다.
     *
     * <p>WARNING: 프로덕션 환경에서는 절대 사용하지 마세요!
     *
     * @param targetStage 변경할 목표 단계
     */
    public void forceChangeStage(InterviewStage targetStage) {
        this.stage = targetStage;
    }

    public void incrementTurnCount() {
        this.turnCount++;
    }

    public void reduceTotalTime() {
        this.targetDurationMinutes = (int) (this.targetDurationMinutes * 0.8);
    }

    public static InterviewSession create(
            String interviewId,
            Candidate candidate,
            Resumes resume,
            List<InterviewRole> roles,
            InterviewPersonality personality,
            InterviewType type,
            String domain,
            int interviewerCount,
            int targetDurationMinutes,
            String selfIntroduction) {
        return InterviewSession.builder()
                .id(java.util.UUID.fromString(interviewId))
                .candidate(candidate)
                .resume(resume)
                .roles(roles)
                .personality(personality)
                .type(type)
                .domain(domain)
                .interviewerCount(interviewerCount)
                .initialTargetDurationMinutes(targetDurationMinutes)
                .targetDurationMinutes(targetDurationMinutes)
                .selfIntroduction(selfIntroduction)
                .status(InterviewSessionStatus.READY)
                .stage(InterviewStage.WAITING)
                .initialDifficulty(3)
                .currentDifficulty(3)
                .lastInterviewerId("LEADER")
                .turnCount(0)
                .build();
    }
}
