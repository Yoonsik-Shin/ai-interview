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
    private final int nextDifficulty;
    private final String currentPersonaId;

    // New Fields for Stage Change Event
    private final String type; // "TRANSCRIPT" or "STAGE_CHANGE"
    private final String currentStage;
    private final String previousStage;
}
