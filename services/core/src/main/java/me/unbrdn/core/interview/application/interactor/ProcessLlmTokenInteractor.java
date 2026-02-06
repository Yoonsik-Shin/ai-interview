package me.unbrdn.core.interview.application.interactor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.dto.command.PushTtsQueueCommand;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewResultCommand;
import me.unbrdn.core.interview.application.event.InterviewerIntroFinishedEvent;
import me.unbrdn.core.interview.application.port.in.ProcessLlmTokenUseCase;
import me.unbrdn.core.interview.application.port.out.AppendRedisCachePort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.port.out.PushTtsQueuePort;
import me.unbrdn.core.interview.application.port.out.SaveInterviewResultPort;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import me.unbrdn.core.interview.domain.model.TokenAccumulator;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessLlmTokenInteractor implements ProcessLlmTokenUseCase {

    private final AppendRedisCachePort appendRedisCachePort;
    private final PublishTranscriptPort publishTranscriptPort;
    private final PushTtsQueuePort pushTtsQueuePort;
    private final SaveInterviewResultPort saveInterviewResultPort;
    private final ManageConversationHistoryPort conversationHistoryPort;
    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;
    private final ApplicationEventPublisher eventPublisher;

    private final Map<String, TokenAccumulator> accumulators = new ConcurrentHashMap<>();

    @Override
    public void execute(ProcessLlmTokenCommand command) {
        String interviewId = command.getInterviewId();

        // 3. 문장 완성 시 TTS Queue Push
        String persona = command.getCurrentPersonaId();
        if (persona == null || persona.isEmpty()) {
            persona = command.getPersona();
        }
        if (persona == null || persona.isEmpty()) {
            persona = "DEFAULT";
        }

        String accumulatorKey = interviewId + ":" + persona;
        TokenAccumulator accumulator = accumulators.computeIfAbsent(accumulatorKey, k -> new TokenAccumulator());

        // 0. Update Session State (Adaptive Logic)
        if (command.isReduceTotalTime() || command.getNextDifficultyLevel() > 0
                || (command.getCurrentPersonaId() != null && !command.getCurrentPersonaId().isEmpty())) {

            boolean shouldUpdate = false;
            if (command.isReduceTotalTime() && !accumulator.isTimeReduced()) {
                shouldUpdate = true;
            }
            if (command.getNextDifficultyLevel() > 0 && !accumulator.isDifficultyUpdated()) {
                shouldUpdate = true;
            }
            if ((command.getCurrentPersonaId() != null && !command.getCurrentPersonaId().isEmpty())
                    && !accumulator.isLastInterviewerUpdated()) {
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                updateSessionStateInCache(command, accumulator);
            }
        }

        if (command.isInterviewEndSignal()) {
            accumulator.setEndSignal(true);
        }

        // 1. Redis Cache에 Append
        if (command.getToken() != null && !command.getToken().isEmpty()) {
            appendRedisCachePort.appendToken(interviewId, command.getToken(), persona);
            accumulator.appendToken(command.getToken());
        }

        // 2. Pub/Sub 발행 (실시간 자막 + THINKING)
        PublishTranscriptCommand publishCommand = PublishTranscriptCommand.builder().interviewId(interviewId)
                .token(command.getToken()).thinking(command.getThinking()).build();
        publishTranscriptPort.publish(publishCommand);

        if (command.isSentenceEnd() && accumulator.hasSentence()) {
            PushTtsQueueCommand ttsCommand = PushTtsQueueCommand.builder().interviewId(interviewId)
                    .interviewSessionId(command.getInterviewSessionId()).sentence(accumulator.getCurrentSentence())
                    .sentenceIndex(accumulator.getSentenceIndex()).persona(persona).mode(command.getMode()).build();
            pushTtsQueuePort.push(ttsCommand);
            accumulator.clearSentence();

            log.info("Pushed TTS sentence: interviewId={}, persona={}, sentenceIndex={}", interviewId, persona,
                    accumulator.getSentenceIndex() - 1);
        }

        // 4. 최종 완료 시
        if (command.isFinal()) {
            handleFinalCompletion(command, accumulator);
            accumulators.remove(accumulatorKey);
        }
    }

    private void updateSessionStateInCache(ProcessLlmTokenCommand command, TokenAccumulator accumulator) {
        try {
            String sessionId = command.getInterviewSessionId();
            InterviewSessionState state = sessionStatePort.getState(sessionId)
                    .orElseGet(InterviewSessionState::createDefault);

            boolean updated = false;

            if (command.isReduceTotalTime() && !accumulator.isTimeReduced()) {
                accumulator.setTimeReduced(true);
                updated = true;
                log.info("Reduced total time (cached) for conversation: {}", sessionId);
            }

            if (command.getNextDifficultyLevel() > 0
                    && (state.getCurrentDifficulty() == null
                            || !state.getCurrentDifficulty().equals(command.getNextDifficultyLevel()))
                    && !accumulator.isDifficultyUpdated()) {
                state.setCurrentDifficulty(command.getNextDifficultyLevel());
                accumulator.setDifficultyUpdated(true);
                updated = true;
                log.info("Updated difficulty (cached) to: {}", command.getNextDifficultyLevel());
            }

            if (command.getCurrentPersonaId() != null && !command.getCurrentPersonaId().isEmpty()
                    && !accumulator.isLastInterviewerUpdated()) {
                state.setLastInterviewerId(command.getCurrentPersonaId());
                accumulator.setLastInterviewerUpdated(true);
                updated = true;
            }

            if (updated) {
                sessionStatePort.saveState(sessionId, state);
            }
        } catch (Exception e) {
            log.error("Failed to update session state in cache", e);
        }
    }

    private void handleFinalCompletion(ProcessLlmTokenCommand command, TokenAccumulator accumulator) {
        String fullResponse = accumulator.getFullResponse();

        log.info("LLM response completed: interviewId={}, responseLength={}", command.getInterviewId(),
                fullResponse.length());

        SaveInterviewResultCommand saveCommand = SaveInterviewResultCommand.builder()
                .interviewId(command.getInterviewId()).userId(command.getUserId()).userAnswer(command.getUserText())
                .aiAnswer(fullResponse).build();
        saveInterviewResultPort.save(saveCommand);

        conversationHistoryPort.appendExchange(command.getInterviewId(), command.getInputRole(), command.getUserText(),
                fullResponse);

        if (accumulator.isEndSignal()) {
            log.info("Interview End Signal received. Transitioning to LAST_QUESTION_PROMPT.");
            try {
                var sessionOpt = interviewPort.loadById(java.util.UUID.fromString(command.getInterviewSessionId()));
                sessionOpt.ifPresent(session -> {
                    session.transitionToLastQuestionPrompt();
                    interviewPort.save(session);
                });
            } catch (Exception e) {
                log.error("Failed to transition to LAST_QUESTION_PROMPT", e);
            }
        } else {
            eventPublisher.publishEvent(InterviewerIntroFinishedEvent.builder().interviewId(command.getInterviewId())
                    .interviewSessionId(command.getInterviewSessionId()).userId(command.getUserId())
                    .mode(command.getMode()).build());
        }
    }
}
