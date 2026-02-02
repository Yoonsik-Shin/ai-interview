package me.unbrdn.core.interview.adapter.out.redis;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.command.PushTtsQueueCommand;
import me.unbrdn.core.interview.application.port.out.PushTtsQueuePort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RedisTtsQueueAdapter implements PushTtsQueuePort {

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private static final String TTS_QUEUE = "tts:sentence:queue";

    @Override
    public void push(PushTtsQueueCommand command) {
        Map<String, Object> message =
                Map.of(
                        "interviewId",
                        command.getInterviewId(),
                        "interviewSessionId",
                        command.getInterviewSessionId(),
                        "sentence",
                        command.getSentence(),
                        "sentenceIndex",
                        command.getSentenceIndex(),
                        "persona",
                        command.getPersona(),
                        "mode",
                        command.getMode());

        try {
            String jsonMessage = objectMapper.writeValueAsString(message);
            redisTemplate.opsForList().rightPush(TTS_QUEUE, jsonMessage);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize TTS message", e);
        }
    }
}
