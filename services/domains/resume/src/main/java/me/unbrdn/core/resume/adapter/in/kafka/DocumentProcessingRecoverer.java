package me.unbrdn.core.resume.adapter.in.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.event.DocumentProcessedEvent;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.listener.ConsumerRecordRecoverer;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kafka retry 5회 소진 후 호출되는 recoverer.
 * 이력서를 FAILED 상태로 전환하여 사용자가 재처리를 요청할 수 있도록 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentProcessingRecoverer implements ConsumerRecordRecoverer {

    private final LoadResumePort loadResumePort;
    private final SaveResumePort saveResumePort;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void accept(ConsumerRecord<?, ?> record, Exception ex) {
        String message = record.value() != null ? record.value().toString() : null;
        log.error("document.processed 메시지 처리 최종 실패 (5회 재시도 소진). offset={}, error={}",
                record.offset(), ex.getMessage());

        if (message == null) {
            log.error("메시지가 null이므로 FAILED 처리 불가");
            return;
        }

        try {
            DocumentProcessedEvent event = objectMapper.readValue(message, DocumentProcessedEvent.class);
            loadResumePort.loadResumeById(UUID.fromString(event.getResumeId()))
                    .ifPresent(resume -> {
                        resume.failProcessing();
                        saveResumePort.save(resume);
                        log.warn("Resume FAILED (재시도 소진): resumeId={}", event.getResumeId());
                    });
        } catch (Exception parseEx) {
            log.error("Recoverer에서 메시지 파싱 실패: {}", parseEx.getMessage());
        }
        // 정상 반환 → Kafka가 offset을 커밋하고 해당 메시지는 더 이상 재시도하지 않음
    }
}
