package me.unbrdn.core.interview.adapter.in.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.UpdateInterviewMessageMediaUrlUseCase;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AudioCompletedRedisConsumer implements MessageListener {

    private final ObjectMapper objectMapper;
    private final UpdateInterviewMessageMediaUrlUseCase updateMediaUrlUseCase;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String body = new String(message.getBody());
            log.info("Received audio completion event: {}", body);

            JsonNode root = objectMapper.readTree(body);
            String interviewId = root.get("interviewId").asText();
            String objectUrl = root.get("objectUrl").asText();
            JsonNode metadata = root.get("metadata");

            if (metadata != null) {
                String role = metadata.has("role") ? metadata.get("role").asText() : "USER";
                int turnCount = metadata.has("turnCount") ? metadata.get("turnCount").asInt() : 0;
                int sequenceNumber =
                        metadata.has("sentenceIndex") ? metadata.get("sentenceIndex").asInt() : 0;

                // For USER messages, turnCount is often in metadata
                // If AI, role is "AI" and sentenceIndex is sequenceNumber

                updateMediaUrlUseCase.execute(
                        new UpdateInterviewMessageMediaUrlUseCase.UpdateMediaUrlCommand(
                                UUID.fromString(interviewId),
                                turnCount,
                                sequenceNumber,
                                role.equalsIgnoreCase("AI") ? MessageRole.AI : MessageRole.USER,
                                objectUrl));
            }

        } catch (Exception e) {
            log.error("Failed to process audio completion event", e);
        }
    }
}
