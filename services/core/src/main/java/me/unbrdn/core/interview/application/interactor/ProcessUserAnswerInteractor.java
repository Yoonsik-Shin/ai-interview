package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessUserAnswerCommand;
import me.unbrdn.core.interview.application.port.in.ProcessUserAnswerUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.model.ConversationHistory;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessUserAnswerInteractor implements ProcessUserAnswerUseCase {

    private final ManageConversationHistoryPort conversationHistoryPort;
    private final CallLlmPort callLlmPort;
    private final InterviewPort interviewPort;
    private final PublishTranscriptPort publishTranscriptPort;
    private final me.unbrdn.core.interview.application.port.out.ManageSessionStatePort
            sessionStatePort;

    @Override
    public void execute(ProcessUserAnswerCommand command) {
        log.info(
                "Processing user answer: interviewId={}, userId={}",
                command.getInterviewId(),
                command.getUserId());

        // 1. InterviewSession 조회하여 InterviewType(mode) 확인
        UUID interviewUuid = UUID.fromString(command.getInterviewId());
        InterviewSession interviewSession =
                interviewPort
                        .loadById(interviewUuid)
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview session not found: "
                                                        + command.getInterviewId()));

        String mode =
                interviewSession
                        .getType()
                        .name()
                        .toLowerCase(); // REAL -> "real", PRACTICE -> "practice"

        // 2. 대화 히스토리 로드 (Before adding current user message)
        List<ConversationHistory> history =
                conversationHistoryPort.loadHistory(command.getInterviewId());

        // 2-1. Save User Message immediately to avoid data loss
        conversationHistoryPort.appendUserMessage(
                command.getInterviewId(),
                "user", // or command.getInputRole() if
                // available here? user is standard
                command.getUserText());

        // 2-2. Update Session State (Increment Turn Count)
        updateTurnCount(command.getInterviewId());

        // 2-3. Check for SELF_INTRO completion transition
        if (interviewSession.getStage()
                == me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO) {
            log.info("Transitioning from SELF_INTRO to IN_PROGRESS upon user answer.");
            interviewSession.transitionToInProgress();
            interviewPort.save(interviewSession);

            // Publish Stage Change Event
            me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand stageEvent =
                    me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand
                            .builder()
                            .interviewId(interviewSession.getSessionUuid())
                            .type("STAGE_CHANGE")
                            .currentStage(interviewSession.getStage().name())
                            .previousStage(
                                    me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO
                                            .name())
                            .build();
            publishTranscriptPort.publish(stageEvent);
        }

        // 3. LLM 호출 (스트리밍)
        // Note: history passed to LLM does NOT include the just-appended user message
        // because we loaded it before appending. This is often correct if the LLM
        // prompt builder appends the current user text separately.
        long totalDurationSeconds = interviewSession.getTargetDurationMinutes() * 60L;
        long elapsed = 0;
        if (interviewSession.getStartedAt() != null) {
            elapsed =
                    java.time.Duration.between(
                                    interviewSession.getStartedAt(), java.time.LocalDateTime.now())
                            .getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(command.getInterviewId())
                        .interviewSessionId(interviewSession.getId().toString())
                        .userId(command.getUserId())
                        .userText(command.getUserText())
                        .availableRoles(interviewSession.getRoles())
                        .personality(interviewSession.getPersonality())
                        .history(history)
                        .mode(mode)
                        .totalDurationSeconds(totalDurationSeconds)
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(interviewSession.getCurrentDifficulty())
                        .lastInterviewerId(interviewSession.getLastInterviewerId())
                        .stage(interviewSession.getStage())
                        .interviewerCount(interviewSession.getInterviewerCount())
                        .domain(interviewSession.getDomain())
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void updateTurnCount(String sessionId) {
        try {
            me.unbrdn.core.interview.domain.model.InterviewSessionState state =
                    sessionStatePort
                            .getState(sessionId)
                            .orElseGet(
                                    me.unbrdn.core.interview.domain.model.InterviewSessionState
                                            ::createDefault);

            Integer currentTurn = state.getTurnCount() != null ? state.getTurnCount() : 0;
            state.setTurnCount(currentTurn + 1);

            sessionStatePort.saveState(sessionId, state);
            log.info(
                    "Incremented turn count to {} for session {}", state.getTurnCount(), sessionId);
        } catch (Exception e) {
            log.error("Failed to update turn count", e);
        }
    }
}
