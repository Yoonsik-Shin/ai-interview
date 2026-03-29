package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PublishTranscriptCommand {
    private final String interviewId;
    private final String token;
    private final String thinking;

    // New Fields for Adaptive UI
    private final boolean reduceTotalTime;
    private final Integer timeLeft; // SECONDS
    private final int nextDifficulty;
    private final String currentPersonaId;

    // New Fields for Stage Change Event
    private final String
            type; // "TRANSCRIPT", "STAGE_CHANGE", "INTERVENE", "RETRY_ANSWER", "TIMER_SYNC"
    private final String currentStage;
    private final String previousStage;
    private final String content;
    private final Integer turnCount;
    private final String status;
    private final boolean canCandidateSpeak;
    private final String activePersonaId;

    // Self Intro Meta
    private final Integer selfIntroRetryCount;
    private final Long selfIntroStart;
    private final Long selfIntroElapsedSeconds;
    private final boolean isMaxRetryExceeded;
}
