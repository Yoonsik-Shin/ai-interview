package me.unbrdn.core.interview.application.interactor;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.dto.command.PushTtsQueueCommand;
import me.unbrdn.core.interview.application.event.InterviewerIntroFinishedEvent;
import me.unbrdn.core.interview.application.port.in.ProcessLlmTokenUseCase;
import me.unbrdn.core.interview.application.port.out.AppendRedisCachePort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.port.out.PushTtsQueuePort;
import me.unbrdn.core.interview.application.port.out.SaveAdjustmentLogPort;
import me.unbrdn.core.interview.application.port.out.SaveSentenceStreamPort;
import me.unbrdn.core.interview.domain.entity.InterviewAdjustmentLog;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessLlmTokenInteractor implements ProcessLlmTokenUseCase {

    private final AppendRedisCachePort appendRedisCachePort;
    private final PublishTranscriptPort publishTranscriptPort;
    private final PushTtsQueuePort pushTtsQueuePort;
    private final ManageConversationHistoryPort conversationHistoryPort;
    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;
    private final SaveAdjustmentLogPort saveAdjustmentLogPort;
    private final ProduceInterviewEventPort produceInterviewEventPort;
    private final ApplicationEventPublisher eventPublisher;
    private final SaveSentenceStreamPort saveSentenceStreamPort;

    private final Map<String, LlmResponseContext> responseContexts = new ConcurrentHashMap<>();

    @Override
    public void execute(ProcessLlmTokenCommand command) {
        String interviewId = command.getInterviewId();

        // 3. 문장 완성 시 TTS Queue Push
        String persona = command.getCurrentPersonaId();
        if (persona == null || persona.isEmpty()) {
            persona = "DEFAULT";
        }

        String contextKey = interviewId + ":" + persona;
        LlmResponseContext context =
                responseContexts.computeIfAbsent(contextKey, k -> new LlmResponseContext());

        // 0. Update Session State (Adaptive Logic)
        if (command.isReduceTotalTime()
                || command.getNextDifficultyLevel() > 0
                || (command.getCurrentPersonaId() != null
                        && !command.getCurrentPersonaId().isEmpty())) {

            boolean shouldUpdate = false;
            if (command.isReduceTotalTime() && !context.isTimeReduced()) {
                shouldUpdate = true;
            }
            if (command.getNextDifficultyLevel() > 0 && !context.isDifficultyUpdated()) {
                shouldUpdate = true;
            }
            if ((command.getCurrentPersonaId() != null && !command.getCurrentPersonaId().isEmpty())
                    && !context.isLastInterviewerUpdated()) {
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                updateSessionStateInCache(command, context);
            }
        }

        if (command.isInterviewEndSignal()) {
            context.setEndSignal(true);
        }

        // 1. Redis Cache에 Append (문장 버퍼, 전체 응답 버퍼)
        if (command.getToken() != null && !command.getToken().isEmpty()) {
            appendRedisCachePort.appendToken(interviewId, command.getToken(), persona);
            appendRedisCachePort.appendSentenceBuffer(interviewId, command.getToken());
            appendRedisCachePort.appendFullResponseBuffer(interviewId, command.getToken());
        }

        // 2. Pub/Sub 발행 (실시간 자막 + THINKING)
        PublishTranscriptCommand publishCommand =
                PublishTranscriptCommand.builder()
                        .interviewId(interviewId)
                        .token(command.getToken())
                        .thinking(command.getThinking())
                        .build();
        publishTranscriptPort.publish(publishCommand);

        if (command.isSentenceEnd()) {
            String sentence = appendRedisCachePort.getAndClearSentenceBuffer(interviewId);
            if (sentence != null && !sentence.trim().isEmpty()) {
                saveSentenceStreamPort.publishSentence(
                        interviewId,
                        persona,
                        context.getSentenceIndex(),
                        sentence,
                        command.isFinal(),
                        command.getMode());

                PushTtsQueueCommand ttsCommand =
                        PushTtsQueueCommand.builder()
                                .interviewId(interviewId)
                                .sentence(sentence)
                                .sentenceIndex(context.getSentenceIndex())
                                .mode(command.getMode())
                                .personaId(persona)
                                .build();
                pushTtsQueuePort.push(ttsCommand);

                log.info(
                        "Pushed TTS and Streams: interviewId={}, persona={}, sentenceIndex={}",
                        interviewId,
                        persona,
                        context.getSentenceIndex());

                context.incrementSentenceIndex();
            }
        }

        // 4. 최종 완료 시
        if (command.isFinal()) {
            handleFinalCompletion(command, context);
            responseContexts.remove(contextKey);
        }
    }

    private void updateSessionStateInCache(
            ProcessLlmTokenCommand command, LlmResponseContext context) {
        try {
            String interviewId = command.getInterviewId();
            InterviewSessionState state =
                    sessionStatePort
                            .getState(interviewId)
                            .orElseGet(
                                    () -> {
                                        var session =
                                                interviewPort
                                                        .loadById(
                                                                java.util.UUID.fromString(
                                                                        interviewId))
                                                        .orElse(null);
                                        if (session == null)
                                            return InterviewSessionState.createDefault();
                                        return InterviewSessionState.fromEntity(session);
                                    });

            boolean updated = false;

            if (command.isReduceTotalTime() && !context.isTimeReduced()) {
                context.setTimeReduced(true);
                updated = true;

                // 1. DB Update
                var sessionOpt = interviewPort.loadById(UUID.fromString(interviewId));
                sessionOpt.ifPresent(
                        session -> {
                            int oldTime = session.getTargetDurationMinutes();
                            session.reduceTotalTime();
                            int newTime = session.getTargetDurationMinutes();
                            interviewPort.save(session);

                            // 2. Adjustment Log
                            var logEntry =
                                    InterviewAdjustmentLog.create(
                                            session.getId(),
                                            "TIME_REDUCTION",
                                            String.valueOf(oldTime),
                                            String.valueOf(newTime),
                                            "AI requested time reduction (ProcessLlmToken)");
                            saveAdjustmentLogPort.save(logEntry);

                            // 3. Redis Sync (remainingTimeSeconds)
                            // 전체 목표 시간이 줄었으므로 남은 시간도 비율에 맞춰 혹은 절대값으로 조정 필요
                            // 여기서는 targetDurationMinutes * 60 - elapsed로 계산하는 로직이 필요함
                            // 하지만 간단히 현재 남은 시간의 80%로 조정하는 방식을 취함
                            if (state.getRemainingTimeSeconds() != null) {
                                long newRemaining = (long) (state.getRemainingTimeSeconds() * 0.8);
                                state.setRemainingTimeSeconds(newRemaining);
                                log.info(
                                        "Updated Redis remainingTimeSeconds: {} -> {}",
                                        state.getRemainingTimeSeconds(),
                                        newRemaining);
                            }
                        });

                log.info("Reduced total time (DB & Cache) for interview: {}", interviewId);
            }

            if (command.getNextDifficultyLevel() > 0
                    && (state.getCurrentDifficulty() == null
                            || !state.getCurrentDifficulty()
                                    .equals(command.getNextDifficultyLevel()))
                    && !context.isDifficultyUpdated()) {
                state.setCurrentDifficulty(command.getNextDifficultyLevel());
                context.setDifficultyUpdated(true);
                updated = true;
                log.info("Updated difficulty (cached) to: {}", command.getNextDifficultyLevel());
            }

            if (command.getCurrentPersonaId() != null
                    && !command.getCurrentPersonaId().isEmpty()
                    && !context.isLastInterviewerUpdated()) {
                state.setLastInterviewerId(command.getCurrentPersonaId());
                context.setLastInterviewerUpdated(true);
                updated = true;
            }

            if (updated) {
                sessionStatePort.saveState(interviewId, state);
            }
        } catch (Exception e) {
            log.error("Failed to update session state in cache", e);
        }
    }

    private void handleFinalCompletion(ProcessLlmTokenCommand command, LlmResponseContext context) {
        String fullResponse =
                appendRedisCachePort.getAndClearFullResponseBuffer(command.getInterviewId());

        log.info(
                "LLM response completed: interviewId={}, responseLength={}",
                command.getInterviewId(),
                fullResponse.length());

        // Only append AI message, as User message was already appended in
        // ProcessUserAnswerInteractor
        conversationHistoryPort.appendAiMessage(command.getInterviewId(), fullResponse);

        // Publish AI Message Event to Kafka/MongoDB for Audit Trail
        produceInterviewEventPort.produceMessage(
                command.getInterviewId(),
                "ASSISTANT",
                "CONTENT",
                fullResponse,
                Collections.singletonMap("persona", command.getCurrentPersonaId()));

        // Check current stage and handle auto-transitions
        try {
            var sessionOpt =
                    interviewPort.loadById(java.util.UUID.fromString(command.getInterviewId()));

            me.unbrdn.core.interview.domain.model.InterviewSessionState state =
                    sessionStatePort
                            .getState(command.getInterviewId())
                            .orElse(
                                    me.unbrdn.core.interview.domain.model.InterviewSessionState
                                            .createDefault());

            // Revert state to LISTENING after AI finished speaking
            state.setStatus(
                    me.unbrdn.core.interview.domain.model.InterviewSessionState.Status.LISTENING);
            sessionStatePort.saveState(command.getInterviewId(), state);

            // Publish turn_complete event to Track 1
            PublishTranscriptCommand turnCompleteCommand =
                    PublishTranscriptCommand.builder()
                            .interviewId(command.getInterviewId())
                            .type("turn_complete")
                            .turnCount(state.getTurnCount() != null ? state.getTurnCount() : 0)
                            .build();
            publishTranscriptPort.publish(turnCompleteCommand);

            sessionOpt.ifPresent(
                    session -> {
                        InterviewStage currentStage = state.getCurrentStage();

                        if (currentStage == InterviewStage.CLOSING_GREETING) {
                            log.info(
                                    "Closing greeting completed, transitioning to COMPLETED: interviewId={}",
                                    command.getInterviewId());
                            session.complete();
                            state.setCurrentStage(InterviewStage.COMPLETED);
                            state.setStatus(
                                    me.unbrdn.core.interview.domain.model.InterviewSessionState
                                            .Status.COMPLETED);
                            sessionStatePort.saveState(command.getInterviewId(), state);
                            interviewPort.save(session);

                            // Publish INTERVIEW_COMPLETED event
                            produceInterviewEventPort.produceMessage(
                                    command.getInterviewId(),
                                    "SYSTEM",
                                    "INTERVIEW_COMPLETED",
                                    "Interview completed successfully",
                                    Collections.emptyMap());
                        }
                    });
        } catch (Exception e) {
            log.error("Failed to handle stage transition after LLM completion", e);
        }

        if (context.isEndSignal()) {
            log.info("Interview End Signal received. Transitioning to LAST_QUESTION_PROMPT.");
            try {
                me.unbrdn.core.interview.domain.model.InterviewSessionState state =
                        sessionStatePort
                                .getState(command.getInterviewId())
                                .orElse(
                                        me.unbrdn.core.interview.domain.model.InterviewSessionState
                                                .createDefault());
                state.setCurrentStage(InterviewStage.LAST_QUESTION_PROMPT);
                sessionStatePort.saveState(command.getInterviewId(), state);
            } catch (Exception e) {
                log.error("Failed to transition to LAST_QUESTION_PROMPT", e);
            }
        } else {
            eventPublisher.publishEvent(
                    InterviewerIntroFinishedEvent.builder()
                            .interviewId(command.getInterviewId())
                            .userId(command.getUserId())
                            .mode(command.getMode())
                            .build());
        }
    }

    private static class LlmResponseContext {
        private int sentenceIndex = 0;
        private boolean endSignal = false;
        private boolean timeReduced = false;
        private boolean difficultyUpdated = false;
        private boolean lastInterviewerUpdated = false;

        public synchronized void incrementSentenceIndex() {
            sentenceIndex++;
        }

        public synchronized int getSentenceIndex() {
            return sentenceIndex;
        }

        public synchronized boolean isEndSignal() {
            return endSignal;
        }

        public synchronized void setEndSignal(boolean endSignal) {
            this.endSignal = endSignal;
        }

        public synchronized boolean isTimeReduced() {
            return timeReduced;
        }

        public synchronized void setTimeReduced(boolean timeReduced) {
            this.timeReduced = timeReduced;
        }

        public synchronized boolean isDifficultyUpdated() {
            return difficultyUpdated;
        }

        public synchronized void setDifficultyUpdated(boolean difficultyUpdated) {
            this.difficultyUpdated = difficultyUpdated;
        }

        public synchronized boolean isLastInterviewerUpdated() {
            return lastInterviewerUpdated;
        }

        public synchronized void setLastInterviewerUpdated(boolean lastInterviewerUpdated) {
            this.lastInterviewerUpdated = lastInterviewerUpdated;
        }
    }
}
