package me.unbrdn.core.interview.application.dto.command;

import java.util.List;
import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.ConversationHistory;

@Getter
@Builder
public class CallLlmCommand {
    private final String interviewId;
    private final String userId;
    private final String userText;
    private final String persona;
    private final List<ConversationHistory> history;
    private final String mode; // "real" | "practice"
    private final InterviewStage stage;
    private final int interviewerCount;
    private final String domain;
}
