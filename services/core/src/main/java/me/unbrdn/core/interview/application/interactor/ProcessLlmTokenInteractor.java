package me.unbrdn.core.interview.application.interactor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.dto.command.PushTtsQueueCommand;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewResultCommand;
import me.unbrdn.core.interview.application.port.in.ProcessLlmTokenUseCase;
import me.unbrdn.core.interview.application.port.out.AppendRedisCachePort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.port.out.PushTtsQueuePort;
import me.unbrdn.core.interview.application.port.out.SaveInterviewResultPort;
import me.unbrdn.core.interview.domain.model.TokenAccumulator;
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

    private final Map<String, TokenAccumulator> accumulators = new ConcurrentHashMap<>();

    @Override
    public void execute(ProcessLlmTokenCommand command) {
        String interviewId = command.getInterviewId();
        TokenAccumulator accumulator =
                accumulators.computeIfAbsent(interviewId, k -> new TokenAccumulator());

        // 1. Redis Cache에 Append
        if (command.getToken() != null && !command.getToken().isEmpty()) {
            appendRedisCachePort.appendToken(interviewId, command.getToken());
            accumulator.appendToken(command.getToken());
        }

        // 2. Pub/Sub 발행 (실시간 자막 + THINKING)
        PublishTranscriptCommand publishCommand =
                PublishTranscriptCommand.builder()
                        .interviewId(interviewId)
                        .token(command.getToken())
                        .thinking(command.getThinking())
                        .build();
        publishTranscriptPort.publish(publishCommand);

        // 3. 문장 완성 시 TTS Queue Push
        if (command.isSentenceEnd() && accumulator.hasSentence()) {
            PushTtsQueueCommand ttsCommand =
                    PushTtsQueueCommand.builder()
                            .interviewId(interviewId)
                            .sentence(accumulator.getCurrentSentence())
                            .sentenceIndex(accumulator.getSentenceIndex())
                            .persona(command.getPersona())
                            .mode(command.getMode())
                            .build();
            pushTtsQueuePort.push(ttsCommand);
            accumulator.clearSentence();

            log.info(
                    "Pushed TTS sentence: interviewId={}, sentenceIndex={}",
                    interviewId,
                    accumulator.getSentenceIndex() - 1);
        }

        // 4. 최종 완료 시
        if (command.isFinal()) {
            handleFinalCompletion(command, accumulator);
            accumulators.remove(interviewId);
        }
    }

    private void handleFinalCompletion(
            ProcessLlmTokenCommand command, TokenAccumulator accumulator) {
        String fullResponse = accumulator.getFullResponse();

        log.info(
                "LLM response completed: interviewId={}, responseLength={}",
                command.getInterviewId(),
                fullResponse.length());

        // PostgreSQL 저장
        SaveInterviewResultCommand saveCommand =
                SaveInterviewResultCommand.builder()
                        .interviewId(command.getInterviewId())
                        .userId(command.getUserId())
                        .userAnswer(command.getUserText())
                        .aiAnswer(fullResponse)
                        .build();
        saveInterviewResultPort.save(saveCommand);

        // Redis 히스토리 갱신
        conversationHistoryPort.appendExchange(
                command.getInterviewId(), command.getUserText(), fullResponse);
    }
}
