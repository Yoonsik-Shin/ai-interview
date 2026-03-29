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

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String TTS_QUEUE = "interview:sentence:queue:tts";

    @Override
    public void push(PushTtsQueueCommand command) {
        Map<String, Object> message =
                Map.of(
                        "interviewId",
                        command.getInterviewId(),
                        "sentence",
                        command.getSentence(),
                        "sentenceIndex",
                        command.getSentenceIndex(),
                        "mode",
                        command.getMode(),
                        "persona",
                        command.getPersonaId() != null ? command.getPersonaId() : "DEFAULT");

        // GenericJacksonJsonRedisSerializer will handle the serialization
        redisTemplate.opsForList().rightPush(TTS_QUEUE, message);
    }
}
