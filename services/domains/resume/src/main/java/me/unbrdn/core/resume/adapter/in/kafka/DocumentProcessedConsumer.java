package me.unbrdn.core.resume.adapter.in.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.application.service.ResumeVectorService;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.resume.domain.event.DocumentProcessedEvent;
import me.unbrdn.core.resume.domain.value.EmbeddingCategory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentProcessedConsumer {

    private final LoadResumePort loadResumePort;
    private final SaveResumePort saveResumePort;
    private final ResumeVectorService resumeVectorService;
    private final ObjectMapper objectMapper;

    /**
     * document.processed 이벤트 소비.
     * 예외 발생 시 KafkaConfig의 DefaultErrorHandler가 jitter backoff로 최대 5회 재시도.
     * 5회 소진 후 DocumentProcessingRecoverer가 resume을 FAILED로 처리.
     */
    @KafkaListener(
            topics = "${kafka.document-processed-topic:document.processed}",
            groupId = "${spring.kafka.consumer.group-id:core-group}")
    @Transactional
    public void consume(String message) throws Exception {
        log.info("Received document.processed event");

        DocumentProcessedEvent event = objectMapper.readValue(message, DocumentProcessedEvent.class);
        UUID resumeId = UUID.fromString(event.getResumeId());

        Resumes resume = loadResumePort
                .loadResumeById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found: " + resumeId));

        if ("COMPLETED".equals(event.getStatus())) {
            // 1. 상태 업데이트 (COMPLETED + content)
            String imageUrlsJson = objectMapper.writeValueAsString(event.getImageUrls());
            resume.completeProcessing(event.getContent(), imageUrlsJson);
            resume.updateVectorStatus("INDEXED");
            saveResumePort.save(resume);

            // 2. 임베딩 저장 (best-effort: 실패 시 status는 유지)
            saveEmbeddingsBestEffort(resume, resumeId, event);

            log.info("Resume processing finalized: resumeId={}", resumeId);
        } else {
            // document 서비스가 처리 실패를 알린 경우 → 즉시 FAILED (재시도 불필요)
            log.error("Document processing failed for resumeId={}: {}", resumeId, event.getError());
            resume.failProcessing();
            saveResumePort.save(resume);
        }
    }

    private void saveEmbeddingsBestEffort(Resumes resume, UUID resumeId, DocumentProcessedEvent event) {
        try {
            int savedCount = 0;

            if (event.getValidationEmbedding() != null && !event.getValidationEmbedding().isEmpty()) {
                // Save as BACKEND_VALIDATION to avoid overwriting the frontend WASM embedding
                // (VALIDATION category). Duplicate detection compares frontend WASM embeddings,
                // so the authoritative VALIDATION embedding must remain frontend-generated.
                resumeVectorService.saveEmbedding(
                        resume.getUserId(), resumeId.toString(), event.getContent(),
                        toFloatArray(event.getValidationEmbedding()),
                        "BACKEND_VALIDATION");
                savedCount++;
            }

            if (event.getChunks() != null && !event.getChunks().isEmpty()) {
                for (DocumentProcessedEvent.ResumeChunk chunk : event.getChunks()) {
                    if (chunk.getEmbedding() != null && !chunk.getEmbedding().isEmpty()) {
                        resumeVectorService.saveEmbedding(
                                resume.getUserId(), resumeId.toString(), chunk.getContent(),
                                toFloatArray(chunk.getEmbedding()),
                                chunk.getCategory() != null
                                        ? chunk.getCategory()
                                        : EmbeddingCategory.RESUME_SUMMARY.name(),
                                chunk.getPageNum());
                        savedCount++;
                    }
                }
            } else if (event.getEmbedding() != null && !event.getEmbedding().isEmpty()) {
                resumeVectorService.saveEmbedding(
                        resume.getUserId(), resumeId.toString(), event.getContent(),
                        toFloatArray(event.getEmbedding()),
                        EmbeddingCategory.RESUME_SUMMARY.name());
                savedCount++;
            }

            log.info("임베딩 저장 완료: resumeId={}, count={}", resumeId, savedCount);
        } catch (Exception e) {
            log.error("임베딩 저장 실패 (resume은 COMPLETED 유지): resumeId={}, error={}", resumeId, e.getMessage());
        }
    }

    private float[] toFloatArray(java.util.List<Float> list) {
        if (list == null) return new float[0];
        float[] array = new float[list.size()];
        for (int i = 0; i < list.size(); i++) {
            array[i] = list.get(i);
        }
        return array;
    }
}
