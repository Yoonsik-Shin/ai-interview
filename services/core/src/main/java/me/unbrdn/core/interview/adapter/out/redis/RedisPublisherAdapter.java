package me.unbrdn.core.interview.adapter.out.redis;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RedisPublisherAdapter implements PublishTranscriptPort {

    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public void publish(PublishTranscriptCommand command) {
        String channel = "interview:transcript:" + command.getInterviewId();

        java.util.Map<String, Object> message = new java.util.HashMap<>();
        message.put("interviewId", command.getInterviewId());
        message.put("token", command.getToken() != null ? command.getToken() : "");
        message.put("thinking", command.getThinking() != null ? command.getThinking() : "");
        message.put("reduceTotalTime", command.isReduceTotalTime());
        message.put("nextDifficulty", command.getNextDifficulty());
        message.put(
                "currentPersonaId",
                command.getCurrentPersonaId() != null ? command.getCurrentPersonaId() : "");
        message.put("timestamp", Instant.now().toString());
        message.put("type", command.getType() != null ? command.getType() : "TRANSCRIPT");
        message.put(
                "currentStage", command.getCurrentStage() != null ? command.getCurrentStage() : "");
        message.put(
                "previousStage",
                command.getPreviousStage() != null ? command.getPreviousStage() : "");
        message.put("content", command.getContent() != null ? command.getContent() : "");

        // GenericJacksonJsonRedisSerializer will handle the serialization
        redisTemplate.convertAndSend(channel, message);
    }
}
