package me.unbrdn.core.interview.adapter.out.redis;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class RedisPublisherAdapter implements PublishTranscriptPort {

    private final RedisTemplate<String, Object> redisTemplate;

    @org.springframework.beans.factory.annotation.Value(
            "${redis.channel.llm-pubsub-prefix:interview:llm:pubsub:}")
    private String channelPrefix;

    @Override
    public void publish(PublishTranscriptCommand command) {
        String channel = channelPrefix + command.getInterviewId();

        java.util.Map<String, Object> message = new java.util.HashMap<>();
        message.put("interviewId", command.getInterviewId());
        message.put("type", command.getType() != null ? command.getType() : "token");
        message.put("token", command.getToken() != null ? command.getToken() : "");
        message.put("thinking", command.getThinking() != null ? command.getThinking() : "");
        message.put("reduceTotalTime", command.isReduceTotalTime());
        message.put("timeLeft", command.getTimeLeft()); // Added
        message.put("nextDifficulty", command.getNextDifficulty());
        message.put(
                "currentPersonaId",
                command.getCurrentPersonaId() != null ? command.getCurrentPersonaId() : "");
        message.put("timestamp", Instant.now().toString());
        message.put(
                "currentStage", command.getCurrentStage() != null ? command.getCurrentStage() : "");
        message.put(
                "previousStage",
                command.getPreviousStage() != null ? command.getPreviousStage() : "");
        message.put("content", command.getContent() != null ? command.getContent() : "");
        message.put("turnCount", command.getTurnCount() != null ? command.getTurnCount() : 0);
        message.put("status", command.getStatus() != null ? command.getStatus() : "");
        message.put("canCandidateSpeak", command.isCanCandidateSpeak());
        message.put(
                "activePersonaId",
                command.getActivePersonaId() != null ? command.getActivePersonaId() : "");

        // [근본 해결] Jackson의 간섭을 최소화하기 위해 수동으로 JSON 바이트를 추출하여 전송 시도
        try {
            String jsonMessage =
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(message);
            log.debug("[RedisPub] Channel: {}, Msg: {}", channel, jsonMessage);

            redisTemplate.execute(
                    (org.springframework.data.redis.connection.RedisConnection connection) -> {
                        connection.publish(channel.getBytes(), jsonMessage.getBytes());
                        return null;
                    });
        } catch (Exception e) {
            log.error("[RedisPub] ERROR: {}", e.getMessage());
            redisTemplate.convertAndSend(channel, message);
        }
    }
}
