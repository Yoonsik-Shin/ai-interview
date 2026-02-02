package me.unbrdn.core.interview.adapter.out.redis;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisPublisherAdapter implements PublishTranscriptPort {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void publish(PublishTranscriptCommand command) {
        String channel = "interview:transcript:" + command.getInterviewId();

        Map<String, Object> message =
                Map.of(
                        "interviewId",
                        command.getInterviewId(),
                        "token",
                        command.getToken() != null ? command.getToken() : "",
                        "thinking",
                        command.getThinking() != null ? command.getThinking() : "",
                        "timestamp",
                        Instant.now().toString());

        try {
            String jsonMessage = objectMapper.writeValueAsString(message);
            redisTemplate.convertAndSend(channel, jsonMessage);
        } catch (Exception e) {
            log.error("Failed to serialize/publish transcript message", e);
        }
    }
}
