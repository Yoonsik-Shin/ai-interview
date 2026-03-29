package me.unbrdn.core.interview.domain.entity;

import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.InterviewRound;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewSession extends BaseTimeEntity {

    private java.util.UUID candidateId;
    private java.util.UUID resumeId;

    private String companyName;
    private InterviewType type;
    private InterviewSessionStatus status;
    private InterviewRound round;
    private Instant startedAt;
    private Instant endedAt;
    private String domain;
    private int scheduledDurationMinutes;
    private java.util.List<String> participatingPersonas;
    private int turnCount;
    private String jobPostingUrl;
    private String selfIntroText;
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
        if (this.status == InterviewSessionStatus.PAUSED) {
            return;
        }
        // READY 상태에서 일시정지 요청이 오면 먼저 시작 상태로 만든 후 일시정지 처리
        if (this.status == InterviewSessionStatus.READY) {
            this.start();
        }
        if (this.status != InterviewSessionStatus.IN_PROGRESS) {
            throw new IllegalStateException("진행 중인 면접만 일시정지할 수 있습니다.");
        }
        this.status = InterviewSessionStatus.PAUSED;
    }

    public void resume() {
        if (this.status == InterviewSessionStatus.IN_PROGRESS) {
            return;
        }
        // READY 상태에서 재개 요청이 오면 바로 시작 처리
        if (this.status == InterviewSessionStatus.READY) {
            this.start();
            return;
        }
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

    public void updateSelfIntroText(String selfIntroText) {
        this.selfIntroText = selfIntroText;
    }

    public static InterviewSession create(
            String interviewId,
            java.util.UUID candidateId,
            java.util.UUID resumeId,
            String companyName,
            InterviewType type,
            InterviewRound round,
            String domain,
            int scheduledDurationMinutes,
            java.util.List<String> participatingPersonas,
            String jobPostingUrl,
            String selfIntroText) {
        return InterviewSession.builder()
                .id(java.util.UUID.fromString(interviewId))
                .candidateId(candidateId)
                .resumeId(resumeId)
                .companyName(companyName)
                .type(type)
                .round(round)
                .domain(domain)
                .scheduledDurationMinutes(scheduledDurationMinutes)
                .participatingPersonas(participatingPersonas)
                .jobPostingUrl(jobPostingUrl)
                .selfIntroText(selfIntroText)
                .status(InterviewSessionStatus.READY)
                .turnCount(0)
                .build();
    }
}
