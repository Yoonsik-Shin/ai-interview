package me.unbrdn.core.interview.domain.model;

import java.io.Serializable;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import me.unbrdn.core.interview.domain.entity.InterviewSession;

/** 면접 진행 중 빈번하게 변경되는 세션의 '뜨거운(Hot)' 상태를 관리하는 객체. Redis Hash에 저장되어 빠른 읽기/쓰기를 지원합니다. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewSessionState implements Serializable {
    public enum Status {
        READY,
        LISTENING,
        THINKING,
        SPEAKING,
        PAUSED,
        COMPLETED,
        CANCELLED
    }

    private static final long serialVersionUID = 1L;

    private Status status;

    private Integer currentDifficulty;
    private String lastInterviewerId;
    private Integer turnCount;
    private Long remainingTimeSeconds;
    private Long startTime; // 면접 시작 시간 (Epoch Memory)
    private Long cumulatedPauseSeconds; // 누적 일시정지 시간
    private me.unbrdn.core.interview.domain.enums.InterviewStage currentStage;
    private String resumeId; // 이력서 ID
    @Builder.Default private boolean canCandidateSpeak = true;

    // Sequential Intro fields
    private List<String> participatingPersonas;
    private Integer nextPersonaIndex;
    private Integer selfIntroRetryCount;
    private String selfIntroText; // 자기소개 무기한 보존용 피봇 필드
    private Long selfIntroStart; // 자기소개 시작 시간 (Epoch ms, 30초 retry 체크용)
    private Long lastRetryAt; // 레이스 컨디션 방지용 마지막 리트라이 시점 (Epoch ms)
    private Long lastStageTransitionAt;
    private String jobPostingUrl;

    public static InterviewSessionState createDefault() {
        return InterviewSessionState.builder()
                .currentDifficulty(3) // 기본값 3
                .status(Status.READY)
                .turnCount(0)
                .selfIntroRetryCount(0)
                .currentStage(me.unbrdn.core.interview.domain.enums.InterviewStage.WAITING)
                .build();
    }

    public static InterviewSessionState fromEntity(InterviewSession session) {
        return InterviewSessionState.builder()
                .resumeId(session.getResumeId() != null ? session.getResumeId().toString() : null)
                .status(Status.READY) // Default for new state
                .currentDifficulty(3)
                .lastInterviewerId("LEADER")
                .turnCount(session.getTurnCount())
                .remainingTimeSeconds(session.getScheduledDurationMinutes() * 60L)
                .selfIntroRetryCount(0)
                .participatingPersonas(
                        session.getParticipatingPersonas()) // FIXED: Load from entity
                .nextPersonaIndex(0)
                .currentStage(me.unbrdn.core.interview.domain.enums.InterviewStage.WAITING)
                .jobPostingUrl(session.getJobPostingUrl())
                .selfIntroText(session.getSelfIntroText())
                .build();
    }
}
