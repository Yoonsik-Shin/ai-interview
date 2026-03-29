package me.unbrdn.core.interview.adapter.in.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.UpdateInterviewMessageMediaUrlUseCase;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StorageCompletedKafkaConsumer {

    private final ObjectMapper objectMapper;
    private final UpdateInterviewMessageMediaUrlUseCase updateMediaUrlUseCase;

    @KafkaListener(
            topics = "${storage.completed.topic:storage.completed}",
            groupId = "${spring.kafka.consumer.group-id:core-group}")
    public void onMessage(String message) {
        try {
            log.info("Received storage completion Kafka event: {}", message);

            JsonNode root = objectMapper.readTree(message);
            String interviewId = root.get("interviewId").asText();
            String userId = root.has("userId") ? root.get("userId").asText() : "unknown";
            String objectUrl = root.get("objectUrl").asText();
            JsonNode metadata = root.get("metadata");

            if (metadata != null) {
                String role = metadata.has("role") ? metadata.get("role").asText() : "USER";
                int turnCount = metadata.has("turnCount") ? metadata.get("turnCount").asInt() : 0;
                int sequenceNumber =
                        metadata.has("sentenceIndex") ? metadata.get("sentenceIndex").asInt() : 0;

                updateMediaUrlUseCase.execute(
                        new UpdateInterviewMessageMediaUrlUseCase.UpdateMediaUrlCommand(
                                UUID.fromString(interviewId),
                                turnCount,
                                sequenceNumber,
                                role.equalsIgnoreCase("AI") ? MessageRole.AI : MessageRole.USER,
                                objectUrl));

                log.info(
                        "Successfully processed storage completion: interviewId={}, userId={}, role={}, turn={}",
                        interviewId,
                        userId,
                        role,
                        turnCount);
            }

        } catch (Exception e) {
            log.error("Failed to process storage completion Kafka event", e);
        }
    }
}
