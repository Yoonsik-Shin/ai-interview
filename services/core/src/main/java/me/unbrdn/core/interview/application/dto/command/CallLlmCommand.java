package me.unbrdn.core.interview.application.dto.command;

import java.util.List;
import lombok.Builder;
import lombok.Getter;
// import me.unbrdn.core.interview.domain.enums.InterviewPersona; // Removed
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.ConversationHistory;

@Getter
@Builder
public class CallLlmCommand {
    private final String interviewId; // legacy sessionUuid
    private final String interviewSessionId; // 실제 PK (ULID)
    private final String userId;
    private final String userText;
    // private final String persona; // Deprecated, use availablePersonas
    private final List<ConversationHistory> history;
    private final String mode; // "real" | "practice"
    private final InterviewStage stage;
    private final int interviewerCount;
    private final String domain;

    // New Fields
    private final List<me.unbrdn.core.interview.domain.enums.InterviewRole> availableRoles;
    private final me.unbrdn.core.interview.domain.enums.InterviewPersonality personality;
    private final long remainingTimeSeconds;
    private final long totalDurationSeconds;
    private final int currentDifficultyLevel;
    private final String lastInterviewerId;

    public String getPersona() {
        return "DEPRECATED"; // Keep for compatibility if needed temporarily
    }
}
