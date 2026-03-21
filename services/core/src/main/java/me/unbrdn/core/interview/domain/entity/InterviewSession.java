package me.unbrdn.core.interview.domain.entity;

import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
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

    private InterviewPersonality personality;
    private InterviewType type;
    private InterviewSessionStatus status;
    private Instant startedAt;
    private Instant endedAt;
    private String domain;
    private int initialTargetDurationMinutes;
    private int targetDurationMinutes;
    private String selfIntroduction;
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

    public boolean isInProgress() {
        return this.status == InterviewSessionStatus.IN_PROGRESS;
    }

    public void pause() {
        if (this.status != InterviewSessionStatus.IN_PROGRESS) {
            throw new IllegalStateException("진행 중인 면접만 일시정지할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.PAUSED;
    }

    public void resume() {
        if (this.status != InterviewSessionStatus.PAUSED) {
            throw new IllegalStateException("일시정지된 면접만 재개할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.IN_PROGRESS;
    }

    public boolean isCompleted() {
        return this.status == InterviewSessionStatus.COMPLETED;
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
            InterviewPersonality personality,
            InterviewType type,
            String domain,
            int targetDurationMinutes,
            String selfIntroduction) {
        return InterviewSession.builder()
                .id(java.util.UUID.fromString(interviewId))
                .candidate(candidate)
                .resume(resume)
                .personality(personality)
                .type(type)
                .domain(domain)
                .initialTargetDurationMinutes(targetDurationMinutes)
                .targetDurationMinutes(targetDurationMinutes)
                .selfIntroduction(selfIntroduction)
                .status(InterviewSessionStatus.READY)
                .turnCount(0)
                .build();
    }
}
