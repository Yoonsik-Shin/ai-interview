package me.unbrdn.core.resume.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.dto.CompleteUploadCommand;
import me.unbrdn.core.resume.application.dto.CompleteUploadResult;
import me.unbrdn.core.resume.application.dto.ResumeDetailDto;
import me.unbrdn.core.resume.application.port.in.CompleteUploadUseCase;
import me.unbrdn.core.resume.application.port.out.DeleteFilePort;
import me.unbrdn.core.resume.application.port.out.GeneratePresignedUrlPort;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.entity.ResumeStatus;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.resume.domain.event.ResumeUploadedEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompleteUploadInteractor implements CompleteUploadUseCase {

    private final LoadResumePort loadResumePort;
    private final SaveResumePort saveResumePort;
    private final GeneratePresignedUrlPort generatePresignedUrlPort;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ResumeVectorService resumeVectorService;
    private final DeleteFilePort deleteFilePort;

    private static final String TOPIC_RESUME_UPLOADED =
            "resume.uploaded"; // Should match Python consumer config

    @Override
    @Transactional
    public CompleteUploadResult execute(CompleteUploadCommand command) {
        // 1. Load New Resume (Uploaded record)
        Resumes newResume =
                loadResumePort
                        .loadResumeById(command.getResumeId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Resume not found: " + command.getResumeId()));

        try {
            // 2. FAILED 상태 이력서 재처리 (retry 경로)
            if (newResume.getStatus() == ResumeStatus.FAILED) {
                log.info("Retrying failed resume processing: resumeId={}", newResume.getId());
                String downloadUrl =
                        generatePresignedUrlPort.generateDownloadUrl(newResume.getFilePath(), true);
                newResume.startProcessing();
                saveResumePort.save(newResume);
                kafkaTemplate.send(
                        TOPIC_RESUME_UPLOADED,
                        newResume.getId().toString(),
                        new ResumeUploadedEvent(
                                newResume.getId().toString(),
                                newResume.getFilePath(),
                                downloadUrl,
                                null));
                String publicUrl =
                        generatePresignedUrlPort.generateDownloadUrl(newResume.getFilePath(), false);
                return CompleteUploadResult.builder()
                        .success(true)
                        .resume(ResumeDetailDto.builder()
                                .id(newResume.getId())
                                .title(newResume.getTitle())
                                .content("")
                                .status(newResume.getStatus().name())
                                .createdAt(newResume.getCreatedAt())
                                .fileUrl(publicUrl)
                                .build())
                        .build();
            }

            // 3. Handle Update Logic (If replacing an existing resume)
            if (command.getExistingResumeId() != null) {
                log.info(
                        "Updating existing resume: {} with new record: {}",
                        command.getExistingResumeId(),
                        command.getResumeId());

                Resumes existingResume =
                        loadResumePort
                                .loadResumeById(command.getExistingResumeId())
                                .orElseThrow(
                                        () ->
                                                new IllegalArgumentException(
                                                        "Existing resume not found: "
                                                                + command.getExistingResumeId()));

                // 권한 확인: 본인의 이력서만 교체 가능
                if (!existingResume.getUserId().equals(newResume.getUserId())) {
                    throw new IllegalArgumentException("본인의 이력서만 교체할 수 있습니다.");
                }

                // 2.1 기존 파일 삭제
                String oldFilePath = existingResume.getFilePath();
                if (oldFilePath != null && !oldFilePath.isEmpty()) {
                    try {
                        deleteFilePort.deleteFile(oldFilePath);
                    } catch (Exception e) {
                        log.error("Failed to delete old file: {}", oldFilePath, e);
                    }
                }

                // 2.2 기존 임베딩 삭제
                try {
                    resumeVectorService.deleteByResumeId(existingResume.getId().toString());
                } catch (Exception e) {
                    log.error(
                            "Failed to delete existing embeddings: {}",
                            command.getExistingResumeId(),
                            e);
                }
            }

            // 3. Generate Download URL for the Document Service (Internal routing)
            String downloadUrl =
                    generatePresignedUrlPort.generateDownloadUrl(newResume.getFilePath(), true);

            // 4. Update Status to PROCESSING
            newResume.startProcessing();
            saveResumePort.save(newResume);

            // 5. Publish Event to Kafka
            ResumeUploadedEvent event =
                    new ResumeUploadedEvent(
                            newResume.getId().toString(),
                            newResume.getFilePath(),
                            downloadUrl,
                            command.getValidationText());

            // Using ID as key for partitioning order
            kafkaTemplate.send(TOPIC_RESUME_UPLOADED, newResume.getId().toString(), event);

            // 6. Save Embedding provided by Frontend as the authoritative VALIDATION embedding.
            // Comparison is always done with a frontend (WASM) embedding, so the stored
            // embedding must also be frontend-generated to ensure same-runtime cosine similarity.
            if (command.getEmbedding() != null && command.getEmbedding().length > 0) {
                log.info("Saving frontend-provided VALIDATION embedding for resume: {}", newResume.getId());
                resumeVectorService.saveEmbedding(
                        newResume.getUserId(),
                        newResume.getId().toString(),
                        command.getValidationText() != null ? command.getValidationText() : "",
                        command.getEmbedding(),
                        "VALIDATION");
            }

            log.info(
                    "Resume upload/update completed. Event published to Kafka: resumeId={}, validationTextPresent={}, embeddingPresent={}",
                    newResume.getId(),
                    command.getValidationText() != null && !command.getValidationText().isEmpty(),
                    command.getEmbedding() != null);

            // 7. Return Enriched Result (Public URL for Frontend)
            String publicUrl =
                    generatePresignedUrlPort.generateDownloadUrl(newResume.getFilePath(), false);
            ResumeDetailDto detailDto =
                    ResumeDetailDto.builder()
                            .id(newResume.getId())
                            .title(newResume.getTitle())
                            .content(newResume.getContent() != null ? newResume.getContent() : "")
                            .status(newResume.getStatus().name())
                            .createdAt(newResume.getCreatedAt())
                            .fileUrl(publicUrl)
                            .build();

            return CompleteUploadResult.builder().success(true).resume(detailDto).build();

        } catch (Exception e) {
            log.error("Failed to complete upload/update process: {}", e.getMessage());
            newResume.failProcessing();
            saveResumePort.save(newResume);
            throw e;
        }
    }
}
