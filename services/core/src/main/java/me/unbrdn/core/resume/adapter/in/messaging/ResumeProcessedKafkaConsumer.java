package me.unbrdn.core.resume.adapter.in.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class ResumeProcessedKafkaConsumer {

    private final LoadResumePort loadResumePort;
    private final SaveResumePort saveResumePort;
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;

    @Transactional
    @KafkaListener(topics = "${kafka.document-processed-topic}", groupId = "${spring.kafka.consumer.group-id:core-group}")
    public void consume(String message) {
        log.info("Kafka 메시지 수신 (document.processed): {}", message);
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> event = objectMapper.readValue(message, Map.class);

            UUID resumeId = UUID.fromString((String) event.get("resumeId"));
            String status = (String) event.get("status");

            Resumes resume = loadResumePort.loadResumeById(resumeId)
                    .orElseThrow(() -> new IllegalArgumentException("이력서를 찾을 수 없습니다. ID: " + resumeId));

            if ("COMPLETED".equals(status)) {
                String content = (String) event.get("content");
                String imageUrls = objectMapper.writeValueAsString(event.get("imageUrls"));
                resume.completeProcessing(content, imageUrls);
            } else {
                resume.failProcessing();
            }

            saveResumePort.save(resume);
            log.info("이력서 처리 결과 반영 완료: resumeId={}, status={}", resumeId, status);

            // Redis Pub/Sub 알림 발송 (Socket 서비스용)
            Map<String, String> notification = Map.of("resumeId", resumeId.toString(), "status", status, "userId",
                    resume.getUser().getId().toString());
            redisTemplate.convertAndSend("resume:processed", notification);
            log.info("Redis Pub/Sub 알림 발송 완료: channel=resume:processed, resumeId={}", resumeId);

        } catch (Exception e) {
            log.error("Kafka 메시지 처리 실패: {}", e.getMessage(), e);
        }
    }
}
