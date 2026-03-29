package me.unbrdn.core.interview.application.interactor;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.event.InterviewerIntroFinishedEvent;
import me.unbrdn.core.interview.application.event.LlmResponseCompletedEvent;
import me.unbrdn.core.interview.application.port.in.ProcessLlmTokenUseCase;
import me.unbrdn.core.interview.application.port.out.AppendRedisCachePort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.port.out.SaveSentenceStreamPort;
import me.unbrdn.core.interview.application.support.TurnStatePublisher;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessLlmTokenInteractor implements ProcessLlmTokenUseCase {

    private final AppendRedisCachePort appendRedisCachePort;
    private final PublishTranscriptPort publishTranscriptPort;
    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;

    private final ProduceInterviewEventPort produceInterviewEventPort;
    private final ApplicationEventPublisher eventPublisher;
    private final SaveSentenceStreamPort saveSentenceStreamPort;
    private final me.unbrdn.core.interview.application.port.out.SaveAdjustmentLogPort
            saveAdjustmentLogPort;
    private final TurnStatePublisher turnStatePublisher;

    private final Map<String, LlmResponseContext> responseContexts = new ConcurrentHashMap<>();

    @Override
    public void execute(ProcessLlmTokenCommand command) {
        String interviewId = command.getInterviewId();

        // 3. 문장 완성 시 TTS Queue Push
        String persona = command.getCurrentPersonaId();
        if (persona == null || persona.isEmpty() || "DEFAULT".equals(persona)) {
            persona =
                    sessionStatePort
                            .getState(interviewId)
                            .map(InterviewSessionState::getLastInterviewerId)
                            .orElse("LEADER");
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
            if (command.getNextDifficultyLevel() > 0) {
                // context의 난이도가 아직 설정되지 않았거나 변경된 경우
                if (context.getDifficultyLevel() == null
                        || !context.getDifficultyLevel().equals(command.getNextDifficultyLevel())) {
                    shouldUpdate = true;
                }
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
            appendRedisCachePort.appendSentenceBuffer(interviewId, command.getToken(), persona);
            appendRedisCachePort.appendFullResponseBuffer(interviewId, command.getToken(), persona);
            markSpeakerActive(command, context, persona);
        }

        // 2. Pub/Sub 발행 (실시간 자막 + THINKING)
        PublishTranscriptCommand publishCommand =
                PublishTranscriptCommand.builder()
                        .interviewId(interviewId)
                        .type("token")
                        .token(command.getToken())
                        .thinking(command.getThinking())
                        .currentPersonaId(command.getCurrentPersonaId())
                        .turnCount(getTurnCount(interviewId))
                        .build();
        publishTranscriptPort.publish(publishCommand);

        if (command.isSentenceEnd()) {
            String sentence = appendRedisCachePort.getAndClearSentenceBuffer(interviewId, persona);
            if (sentence != null && !sentence.trim().isEmpty()) {
                // 현재 컨텍스트에 난이도가 없다면 상태에서 로드
                if (context.getDifficultyLevel() == null) {
                    sessionStatePort
                            .getState(interviewId)
                            .ifPresent(s -> context.setDifficultyLevel(s.getCurrentDifficulty()));
                }

                saveSentenceStreamPort.publishSentence(
                        interviewId,
                        persona,
                        context.getSentenceIndex(),
                        sentence,
                        command.isFinal(),
                        command.getMode(),
                        context.getDifficultyLevel(),
                        getTurnCount(interviewId),
                        getStageName(interviewId),
                        MessageRole.AI,
                        MessageSource.LLM);

                log.debug(
                        "Pushed TTS and Streams: interviewId={}, persona={}, sentenceIndex={}, difficulty={}",
                        interviewId,
                        persona,
                        context.getSentenceIndex(),
                        context.getDifficultyLevel());

                context.incrementSentenceIndex();
            }
        }

        // 4. 최종 완료 시
        if (command.isFinal()) {
            flushPendingSentence(interviewId, persona, context, command);
            LlmResponseContext removedContext = responseContexts.remove(contextKey);
            if (removedContext != null) {
                handleFinalCompletion(command, removedContext, persona);
            } else {
                log.debug("Skip redundant final completion for: {}", contextKey);
            }
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

                long currentRemaining =
                        state.getRemainingTimeSeconds() != null
                                ? state.getRemainingTimeSeconds()
                                : 0L;
                long reductionSeconds = 120L; // 2 minutes
                long nextRemaining = Math.max(0, currentRemaining - reductionSeconds);
                state.setRemainingTimeSeconds(nextRemaining);

                log.info(
                        "Time reduction requested by LLM. Remaining time reduced from {}s to {}s",
                        currentRemaining,
                        nextRemaining);

                // Publish timer sync event to Frontend
                publishTranscriptPort.publish(
                        PublishTranscriptCommand.builder()
                                .interviewId(interviewId)
                                .type("timer_sync")
                                .timeLeft((int) nextRemaining)
                                .reduceTotalTime(true)
                                .build());

                // Save Adjustment Log
                saveAdjustmentLogPort.save(
                        me.unbrdn.core.interview.domain.entity.InterviewAdjustmentLog.create(
                                java.util.UUID.fromString(interviewId),
                                "TIME_REDUCTION",
                                String.valueOf(currentRemaining),
                                String.valueOf(nextRemaining),
                                "Interview duration reduced by AI due to session flow"));
            }

            if (command.getNextDifficultyLevel() > 0
                    && (state.getCurrentDifficulty() == null
                            || !state.getCurrentDifficulty()
                                    .equals(command.getNextDifficultyLevel()))
                    && !context.isDifficultyUpdated()) {

                String oldDifficulty = String.valueOf(state.getCurrentDifficulty());
                state.setCurrentDifficulty(command.getNextDifficultyLevel());
                context.setDifficultyLevel(command.getNextDifficultyLevel());
                context.setDifficultyUpdated(true);
                updated = true;
                log.info(
                        "Updated difficulty (cached) to {} for interviewId={}",
                        command.getNextDifficultyLevel(),
                        interviewId);

                // Save Adjustment Log
                saveAdjustmentLogPort.save(
                        me.unbrdn.core.interview.domain.entity.InterviewAdjustmentLog.create(
                                java.util.UUID.fromString(interviewId),
                                "DIFFICULTY_CHANGE",
                                oldDifficulty,
                                String.valueOf(command.getNextDifficultyLevel()),
                                "Adaptive difficulty adjustment by AI"));
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

    private void handleFinalCompletion(
            ProcessLlmTokenCommand command, LlmResponseContext context, String persona) {
        String fullResponse =
                appendRedisCachePort.getAndClearFullResponseBuffer(
                        command.getInterviewId(), persona);

        log.debug(
                "LLM response completed: interviewId={}, personaId={}",
                command.getInterviewId(),
                command.getCurrentPersonaId());

        // Publish AI Message Event to Kafka/MongoDB for Audit Trail
        produceInterviewEventPort.produceMessage(
                command.getInterviewId(),
                "ASSISTANT",
                "CONTENT",
                fullResponse,
                Collections.singletonMap("persona", command.getCurrentPersonaId()));

        // Check current stage and handle auto-transitions
        me.unbrdn.core.interview.domain.model.InterviewSessionState state =
                sessionStatePort
                        .getState(command.getInterviewId())
                        .orElse(
                                me.unbrdn.core.interview.domain.model.InterviewSessionState
                                        .createDefault());
        try {
            // [FIX] IN_PROGRESS(일반 질문) 뿐만 아니라 LAST_ANSWER(마지막 답변 유도 후) 단계에서도 사용자 발화를 허용합니다.
            if (state.getCurrentStage() == InterviewStage.IN_PROGRESS || 
                state.getCurrentStage() == InterviewStage.LAST_QUESTION_PROMPT ||
                state.getCurrentStage() == InterviewStage.LAST_ANSWER) {
                
                state.setStatus(
                        me.unbrdn.core.interview.domain.model.InterviewSessionState.Status
                                .LISTENING);
                state.setCanCandidateSpeak(true);
                sessionStatePort.saveState(command.getInterviewId(), state);
                turnStatePublisher.publish(
                        command.getInterviewId(), state, command.getCurrentPersonaId());
            }

            // Publish turn_complete event to Track 1
            PublishTranscriptCommand turnCompleteCommand =
                    PublishTranscriptCommand.builder()
                            .interviewId(command.getInterviewId())
                            .type("turn_complete")
                            .turnCount(state.getTurnCount() != null ? state.getTurnCount() : 0)
                            .build();
            publishTranscriptPort.publish(turnCompleteCommand);

            // [FIXED] Specific event for INTERVIEWER_INTRO for backward compatibility /
            // multi-listener logic
            if (state.getCurrentStage() == InterviewStage.INTERVIEWER_INTRO) {
                log.debug("Interviewer intro response finished. Firing IntroFinishedEvent.");
                eventPublisher.publishEvent(
                        InterviewerIntroFinishedEvent.builder()
                                .interviewId(command.getInterviewId())
                                .userId(command.getUserId())
                                .mode(command.getMode())
                                .build());
            }

            // Publish general LlmResponseCompletedEvent for sequence management
            eventPublisher.publishEvent(
                    LlmResponseCompletedEvent.builder()
                            .interviewId(command.getInterviewId())
                            .userId(command.getUserId())
                            .mode(command.getMode())
                            .stage(state.getCurrentStage())
                            .isEndSignal(context.isEndSignal())
                            .build());

        } catch (Exception e) {
            log.error("Failed to handle stage transition after LLM completion", e);
        }
    }

    private static class LlmResponseContext {
        private int sentenceIndex = 0;
        private boolean endSignal = false;
        private boolean timeReduced = false;
        private boolean difficultyUpdated = false;
        private Integer difficultyLevel = null;
        private boolean lastInterviewerUpdated = false;
        private boolean speakerStarted = false;

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

        public synchronized Integer getDifficultyLevel() {
            return difficultyLevel;
        }

        public synchronized void setDifficultyLevel(Integer difficultyLevel) {
            this.difficultyLevel = difficultyLevel;
        }

        public synchronized boolean isLastInterviewerUpdated() {
            return lastInterviewerUpdated;
        }

        public synchronized void setLastInterviewerUpdated(boolean lastInterviewerUpdated) {
            this.lastInterviewerUpdated = lastInterviewerUpdated;
        }

        public synchronized boolean isSpeakerStarted() {
            return speakerStarted;
        }

        public synchronized void setSpeakerStarted(boolean speakerStarted) {
            this.speakerStarted = speakerStarted;
        }
    }

    private void markSpeakerActive(
            ProcessLlmTokenCommand command, LlmResponseContext context, String persona) {
        if (context.isSpeakerStarted()) {
            return;
        }

        sessionStatePort
                .getState(command.getInterviewId())
                .ifPresent(
                        state -> {
                            state.setStatus(InterviewSessionState.Status.SPEAKING);
                            state.setLastInterviewerId(persona);
                            state.setCanCandidateSpeak(false);
                            sessionStatePort.saveState(command.getInterviewId(), state);
                            turnStatePublisher.publish(command.getInterviewId(), state, persona);
                            context.setSpeakerStarted(true);
                        });
    }

    private void flushPendingSentence(
            String interviewId,
            String persona,
            LlmResponseContext context,
            ProcessLlmTokenCommand command) {
        String sentence = appendRedisCachePort.getAndClearSentenceBuffer(interviewId, persona);
        if (sentence == null || sentence.trim().isEmpty()) {
            return;
        }

        if (context.getDifficultyLevel() == null) {
            sessionStatePort
                    .getState(interviewId)
                    .ifPresent(s -> context.setDifficultyLevel(s.getCurrentDifficulty()));
        }

        saveSentenceStreamPort.publishSentence(
                interviewId,
                persona,
                context.getSentenceIndex(),
                sentence,
                true,
                command.getMode(),
                context.getDifficultyLevel(),
                getTurnCount(interviewId),
                getStageName(interviewId),
                MessageRole.AI,
                MessageSource.LLM);
        context.incrementSentenceIndex();
    }

    private Integer getTurnCount(String interviewId) {
        return sessionStatePort
                .getState(interviewId)
                .map(InterviewSessionState::getTurnCount)
                .orElse(0);
    }

    private String getStageName(String interviewId) {
        return sessionStatePort
                .getState(interviewId)
                .map(InterviewSessionState::getCurrentStage)
                .map(InterviewStage::name)
                .orElse(InterviewStage.IN_PROGRESS.name());
    }
}
