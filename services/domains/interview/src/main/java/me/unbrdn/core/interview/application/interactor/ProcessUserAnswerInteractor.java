package me.unbrdn.core.interview.application.interactor;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessUserAnswerCommand;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.port.in.ProcessUserAnswerUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.port.out.SaveAdjustmentLogPort;
import me.unbrdn.core.interview.application.port.out.SaveInterviewMessagePort;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessUserAnswerInteractor implements ProcessUserAnswerUseCase {

    private final CallLlmPort callLlmPort;
    private final InterviewPort interviewPort;
    private final PublishTranscriptPort publishTranscriptPort;
    private final ManageSessionStatePort sessionStatePort;
    private final SaveAdjustmentLogPort saveAdjustmentLogPort;
    private final SaveInterviewMessagePort saveInterviewMessagePort;

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

        me.unbrdn.core.interview.domain.model.InterviewSessionState state =
                sessionStatePort
                        .getState(command.getInterviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "Track 3 state missing for "
                                                        + command.getInterviewId()));

        if (state.getStatus()
                != me.unbrdn.core.interview.domain.model.InterviewSessionState.Status.LISTENING) {
            log.warn("Drop message - Session not LISTENING. Current: {}", state.getStatus());
            return;
        }
        state.setStatus(
                me.unbrdn.core.interview.domain.model.InterviewSessionState.Status.THINKING);
        sessionStatePort.saveState(command.getInterviewId(), state);

        // Publish clear_turn to ensure Frontend UI is ready for new tokens (Track 1 UX Sync)
        PublishTranscriptCommand clearTurnCommand =
                PublishTranscriptCommand.builder()
                        .interviewId(command.getInterviewId())
                        .type("clear_turn")
                        .turnCount(state.getTurnCount() != null ? state.getTurnCount() : 0)
                        .build();
        publishTranscriptPort.publish(clearTurnCommand);

        String mode =
                interviewSession
                        .getType()
                        .name()
                        .toLowerCase(); // REAL -> "real", PRACTICE -> "practice"

        // 2. [REMOVED for Phase 6] 대화 히스토리 로드는 더 이상 Core에서 하지 않음.

        // 2-1. Persist user message to DB for report generation
        try {
            InterviewMessage userMessage = InterviewMessage.create(
                    interviewSession,
                    state.getTurnCount() != null ? state.getTurnCount() : 0,
                    0,
                    state.getCurrentStage(),
                    MessageRole.USER,
                    command.getUserText(),
                    null);
            saveInterviewMessagePort.save(userMessage);
        } catch (Exception e) {
            log.error("Failed to persist user message to DB: interviewId={}", command.getInterviewId(), e);
        }

        // 2-2. Update Session State (Increment Turn Count)
        updateTurnCount(interviewSession);

        // 2-3. Check for SELF_INTRO completion transition
        if (state.getCurrentStage() == InterviewStage.SELF_INTRO) {
            long elapsedSeconds = awaitElapsedSeconds(command.getInterviewId());
            int retryCount = getSelfIntroRetryCount(command.getInterviewId());

            boolean isForcedCompletion =
                    command.getUserText() != null
                            && (command.getUserText().contains("자기소개 생략")
                                    || command.getUserText().contains("자기소개 시간 초과"));

            if (!isForcedCompletion && elapsedSeconds < 30 && retryCount < 2) {
                log.info(
                        "Self intro too short (elapsed={}s), requesting retry (count={})",
                        elapsedSeconds,
                        retryCount + 1);
                incrementSelfIntroRetryCount(command.getInterviewId());

                // Publish RETRY_ANSWER event to Redis Pub/Sub → Socket → Frontend
                PublishTranscriptCommand retryEvent =
                        PublishTranscriptCommand.builder()
                                .interviewId(command.getInterviewId())
                                .type("RETRY_ANSWER")
                                .content("Self intro too short. Please elaborate.")
                                .currentStage(state.getCurrentStage().name())
                                .previousStage(InterviewStage.SELF_INTRO.name())
                                .build();
                publishTranscriptPort.publish(retryEvent);

                // Reset selfIntroStart so the next retry attempt measures elapsed from now
                stringRedisTemplate.opsForHash().put(
                        "interview:session:" + command.getInterviewId(),
                        "selfIntroStart",
                        String.valueOf(System.currentTimeMillis()));

                // Revert state to LISTENING for next retry loop
                state.setStatus(
                        me.unbrdn.core.interview.domain.model.InterviewSessionState.Status
                                .LISTENING);
                sessionStatePort.saveState(command.getInterviewId(), state);

                return; // Skip LLM call for a retry prompt
            } else {
                log.info(
                        "Self intro completed (elapsed={}s) or max retries reached, transitioning to IN_PROGRESS",
                        elapsedSeconds);
                state.setCurrentStage(InterviewStage.IN_PROGRESS);
                state.setSelfIntroText(command.getUserText()); // 무기한 보존용 텍스트 저장
                sessionStatePort.saveState(command.getInterviewId(), state);
                try {
                    interviewPort.save(interviewSession);
                } catch (ObjectOptimisticLockingFailureException e) {
                    log.warn(
                            "SELF_INTRO->IN_PROGRESS transition skipped (optimistic lock conflict): {}",
                            e.getMessage());
                    return;
                }

                // Publish Stage Change Event
                PublishTranscriptCommand stageEvent =
                        PublishTranscriptCommand.builder()
                                .interviewId(command.getInterviewId())
                                .type("STAGE_CHANGE")
                                .currentStage(state.getCurrentStage().name())
                                .previousStage(InterviewStage.SELF_INTRO.name())
                                .build();
                publishTranscriptPort.publish(stageEvent);
            }
        }

        // 3. LLM 호출 (스트리밍)
        // Note: history passed to LLM does NOT include the just-appended user message
        // because we loaded it before appending. This is often correct if the LLM
        // prompt builder appends the current user text separately.
        long totalDurationSeconds = interviewSession.getScheduledDurationMinutes() * 60L;
        long elapsed = 0;
        if (interviewSession.getStartedAt() != null) {
            elapsed = Duration.between(interviewSession.getStartedAt(), Instant.now()).getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(command.getInterviewId())
                        .resumeId(
                                state.getResumeId() != null
                                        ? state.getResumeId()
                                        : (interviewSession.getResumeId() != null
                                                ? interviewSession.getResumeId().toString()
                                                : null))
                        .userId(command.getUserId())
                        .userText(command.getUserText())
                        .personaId("DEFAULT") // Not tracking personality enum anymore
                        .mode(mode)
                        .companyName(interviewSession.getCompanyName())
                        .scheduledDurationMinutes(interviewSession.getScheduledDurationMinutes())
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(
                                state.getCurrentDifficulty() != null
                                        ? state.getCurrentDifficulty()
                                        : 3)
                        .lastInterviewerId(
                                state.getLastInterviewerId() != null
                                        ? state.getLastInterviewerId()
                                        : "LEADER")
                        .stage(state.getCurrentStage())
                        .interviewerCount(
                                state.getParticipatingPersonas() != null
                                        ? state.getParticipatingPersonas().size()
                                        : 1)
                        .domain(interviewSession.getDomain())
                        .participatingPersonas(state.getParticipatingPersonas())
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
            log.warn("selfIntroStart not found in Redis. Treating as already completed to avoid accidental retry.");
            return Long.MAX_VALUE;
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
