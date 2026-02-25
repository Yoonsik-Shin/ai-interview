package me.unbrdn.core.interview.adapter.out.event;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaInterviewEventAdapter implements ProduceInterviewEventPort {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.interview-messages-topic:interview.messages}")
    private String topic;

    @Override
    public void produceMessage(
            String interviewId,
            String role,
            String type,
            String content,
            Map<String, Object> payload) {
        Map<String, Object> event = new HashMap<>();
        event.put("interview_id", interviewId);

        Map<String, Object> payloadData = new HashMap<>();
        payloadData.put("role", role);
        payloadData.put("type", type);
        payloadData.put("content", content);
        payloadData.put("timestamp", Instant.now().toString());
        payloadData.put("payload", payload);

        event.put("payload", payloadData);

        try {
            // Use interviewId as Partition Key for Ordering
            kafkaTemplate.send(topic, interviewId, event);
            log.debug(
                    "Sent interview message to Kafka: topic={}, interviewId={}, role={}",
                    topic,
                    interviewId,
                    role);
        } catch (Exception e) {
            log.error("Failed to send interview message to Kafka", e);
        }
    }
}
