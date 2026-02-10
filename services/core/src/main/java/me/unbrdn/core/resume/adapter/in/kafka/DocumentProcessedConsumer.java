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

    @KafkaListener(
            topics = "${kafka.document-processed-topic:document.processed}",
            groupId = "${spring.kafka.consumer.group-id:core-group}")
    @Transactional
    public void consume(String message) {
        log.info("Received document.processed event");
        try {
            DocumentProcessedEvent event =
                    objectMapper.readValue(message, DocumentProcessedEvent.class);
            UUID resumeId = UUID.fromString(event.getResumeId());

            Resumes resume =
                    loadResumePort
                            .loadResumeById(resumeId)
                            .orElseThrow(
                                    () ->
                                            new IllegalArgumentException(
                                                    "Resume not found: " + resumeId));

            if ("COMPLETED".equals(event.getStatus())) {
                // 1. Update Resume Status & Content
                String imageUrlsJson = objectMapper.writeValueAsString(event.getImageUrls());
                resume.completeProcessing(event.getContent(), imageUrlsJson);
                resume.updateVectorStatus("INDEXED");
                saveResumePort.save(resume);

                // 2. Save Embeddings
                // Case 2a: Save Validation Embedding (for duplicate check)
                if (event.getValidationEmbedding() != null
                        && !event.getValidationEmbedding().isEmpty()) {
                    float[] validationArray = toFloatArray(event.getValidationEmbedding());
                    resumeVectorService.saveEmbedding(
                            resume.getUser().getId(),
                            resumeId.toString(),
                            event.getContent(), // Use
                            // global
                            // content
                            // or
                            // first
                            // 3000
                            // chars
                            // for
                            // reference
                            validationArray,
                            EmbeddingCategory.VALIDATION.name());
                }

                // Case 2b: Save Chunked Embeddings (for RAG)
                if (event.getChunks() != null && !event.getChunks().isEmpty()) {
                    for (DocumentProcessedEvent.ResumeChunk chunk : event.getChunks()) {
                        if (chunk.getEmbedding() != null && !chunk.getEmbedding().isEmpty()) {
                            float[] chunkArray = toFloatArray(chunk.getEmbedding());
                            resumeVectorService.saveEmbedding(
                                    resume.getUser().getId(),
                                    resumeId.toString(),
                                    chunk.getContent(),
                                    chunkArray,
                                    chunk.getCategory() != null
                                            ? chunk.getCategory()
                                            : EmbeddingCategory.RESUME_SUMMARY.name(),
                                    chunk.getPageNum());
                        }
                    }
                } else if (event.getEmbedding() != null && !event.getEmbedding().isEmpty()) {
                    // Fallback to legacy single embedding if chunks are missing
                    float[] embeddingArray = toFloatArray(event.getEmbedding());
                    resumeVectorService.saveEmbedding(
                            resume.getUser().getId(),
                            resumeId.toString(),
                            event.getContent(),
                            embeddingArray,
                            EmbeddingCategory.RESUME_SUMMARY.name());
                }

                log.info(
                        "Resume processing finalized with multiple embeddings: resumeId={}",
                        resumeId);

            } else {
                // Failed
                log.error(
                        "Document processing failed for resumeId={}: {}",
                        resumeId,
                        event.getError());
                resume.failProcessing();
                saveResumePort.save(resume);
            }

        } catch (Exception e) {
            log.error("Failed to consume document.processed event: {}", e.getMessage(), e);
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
