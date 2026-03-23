package me.unbrdn.core.resume.adapter.out.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.port.out.ProduceResumeEventPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaResumeEventProducer implements ProduceResumeEventPort {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${kafka.document-process-topic}")
    private String topic;

    @Override
    public void sendProcessEvent(UUID resumeId, String filePath, String downloadUrl) {
        Map<String, Object> event = new HashMap<>();
        event.put("resumeId", resumeId.toString());
        event.put("filePath", filePath);
        event.put("downloadUrl", downloadUrl);
        event.put("type", "RESUME"); // document 서비스가 처리할 문서 타입

        try {
            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, resumeId.toString(), message);
            log.info("Kafka 이벤트 발행 성공: topic={}, resumeId={}", topic, resumeId);
        } catch (JsonProcessingException e) {
            log.error("Kafka 메시지 직렬화 실패: {}", e.getMessage());
            throw new RuntimeException("이벤트 발행 시 직렬화에 실패했습니다.", e);
        }
    }
}
