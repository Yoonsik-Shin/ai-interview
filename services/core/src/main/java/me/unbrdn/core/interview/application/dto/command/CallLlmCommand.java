package me.unbrdn.core.interview.application.dto.command;

import java.util.List;
import lombok.Builder;
import lombok.Getter;
// import me.unbrdn.core.interview.domain.enums.InterviewPersona; // Removed
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.ConversationHistory;

@Getter
@Builder
public class CallLlmCommand {
    private final String interviewId;
    private final String userId;
    private final String userText;
    private final String inputRole; // "user" or "system"
    private final List<ConversationHistory> history;
    private final String mode; // "real" | "practice"
    private final InterviewStage stage;
    private final int interviewerCount;
    private final String domain;
    private final List<InterviewRole> availableRoles;
    private final InterviewPersonality personality;
    private final long remainingTimeSeconds;
    private final long totalDurationSeconds;
    private final int currentDifficultyLevel;
    private final String lastInterviewerId;
}
