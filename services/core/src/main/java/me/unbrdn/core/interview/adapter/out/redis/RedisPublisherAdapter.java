package me.unbrdn.core.interview.adapter.out.redis;

import java.time.Instant;
import java.util.Map;
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

        Map<String, Object> message =
                Map.of(
                        "interviewId",
                        command.getInterviewId(),
                        "token",
                        command.getToken() != null ? command.getToken() : "",
                        "thinking",
                        command.getThinking() != null ? command.getThinking() : "",
                        "reduceTotalTime",
                        command.isReduceTotalTime(),
                        "nextDifficulty",
                        command.getNextDifficulty(),
                        "currentPersonaId",
                        command.getCurrentPersonaId() != null ? command.getCurrentPersonaId() : "",
                        "timestamp",
                        Instant.now().toString(),
                        "type",
                        command.getType() != null ? command.getType() : "TRANSCRIPT",
                        "currentStage",
                        command.getCurrentStage() != null ? command.getCurrentStage() : "",
                        "previousStage",
                        command.getPreviousStage() != null ? command.getPreviousStage() : "");

        // GenericJacksonJsonRedisSerializer will handle the serialization
        redisTemplate.convertAndSend(channel, message);
    }
}
