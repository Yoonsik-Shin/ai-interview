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
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.port.out.SaveAdjustmentLogPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.model.ConversationHistory;
import org.springframework.data.redis.core.StringRedisTemplate;
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
    private final SaveAdjustmentLogPort saveAdjustmentLogPort;
    private final ProduceInterviewEventPort produceInterviewEventPort;
    private final StringRedisTemplate stringRedisTemplate;

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
        updateTurnCount(interviewSession);

        // 2-3. Check for SELF_INTRO completion transition
        if (interviewSession.getStage()
                == me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO) {
            long elapsedSeconds = awaitElapsedSeconds(command.getInterviewId());
            int retryCount = getSelfIntroRetryCount(command.getInterviewId());

            if (elapsedSeconds < 30 && retryCount < 2) {
                log.info(
                        "Self intro too short (elapsed={}s), requesting retry (count={})",
                        elapsedSeconds,
                        retryCount + 1);
                incrementSelfIntroRetryCount(command.getInterviewId());

                // Emit RETRY_ANSWER event to Frontend (to play pre-recorded audio)
                produceInterviewEventPort.produceMessage(
                        command.getInterviewId(),
                        "SYSTEM",
                        "RETRY_ANSWER",
                        "Self intro too short",
                        java.util.Collections.emptyMap());

                // Publish Stage Change Event (optional, if retry is considered a stage change)
                me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand
                        stageEvent =
                                me.unbrdn.core.interview.application.dto.command
                                        .PublishTranscriptCommand.builder()
                                        .interviewId(command.getInterviewId())
                                        .type("SELF_INTRO_RETRY")
                                        .currentStage(interviewSession.getStage().name())
                                        .previousStage(
                                                me.unbrdn.core.interview.domain.enums.InterviewStage
                                                        .SELF_INTRO
                                                        .name())
                                        .content("Self-introduction too short. Please elaborate.")
                                        .build();
                publishTranscriptPort.publish(stageEvent);
                return; // Skip LLM call for a retry prompt
            } else {
                log.info(
                        "Self intro completed (elapsed={}s) or max retries reached, transitioning to IN_PROGRESS",
                        elapsedSeconds);
                interviewSession.transitionToInProgress();
                interviewPort.save(interviewSession);

                // Publish Stage Change Event
                me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand
                        stageEvent =
                                me.unbrdn.core.interview.application.dto.command
                                        .PublishTranscriptCommand.builder()
                                        .interviewId(command.getInterviewId())
                                        .type("STAGE_CHANGE")
                                        .currentStage(interviewSession.getStage().name())
                                        .previousStage(
                                                me.unbrdn.core.interview.domain.enums.InterviewStage
                                                        .SELF_INTRO
                                                        .name())
                                        .build();
                publishTranscriptPort.publish(stageEvent);
            }
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

    private void updateTurnCount(InterviewSession session) {
        String interviewId = session.getId().toString();
        try {
            // 1. Redis State Update (Atomic)
            int newTurnCount = sessionStatePort.incrementTurnCount(interviewId);

            // 2. DB Entity Update (Direct)
            session.incrementTurnCount();
            interviewPort.save(session);

            log.info(
                    "Incremented turn count to {} (Redis: {}) for session {}",
                    session.getTurnCount(),
                    newTurnCount,
                    interviewId);
        } catch (Exception e) {
            log.error("Failed to update turn count", e);
        }
    }

    private long awaitElapsedSeconds(String interviewId) {
        Object startObj =
                stringRedisTemplate
                        .opsForHash()
                        .get("interview:session:" + interviewId, "selfIntroStart");
        if (startObj != null) {
            try {
                long startTime = Long.parseLong(startObj.toString());
                return (System.currentTimeMillis() - startTime) / 1000;
            } catch (NumberFormatException e) {
                log.warn("Failed to parse selfIntroStart from Redis: {}", startObj);
            }
        } else {
            log.warn("selfIntroStart not found in Redis. Socket might not have set it.");
        }
        return 0;
    }

    private int getSelfIntroRetryCount(String interviewId) {
        return sessionStatePort
                .getState(interviewId)
                .map(
                        state ->
                                state.getSelfIntroRetryCount() != null
                                        ? state.getSelfIntroRetryCount()
                                        : 0)
                .orElse(0);
    }

    private void incrementSelfIntroRetryCount(String interviewId) {
        sessionStatePort
                .getState(interviewId)
                .ifPresent(
                        state -> {
                            int current =
                                    state.getSelfIntroRetryCount() != null
                                            ? state.getSelfIntroRetryCount()
                                            : 0;
                            state.setSelfIntroRetryCount(current + 1);
                            sessionStatePort.saveState(interviewId, state);
                        });
    }
}
