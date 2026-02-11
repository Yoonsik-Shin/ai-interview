package me.unbrdn.core.resume.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.dto.CompleteUploadCommand;
import me.unbrdn.core.resume.application.port.in.CompleteUploadUseCase;
import me.unbrdn.core.resume.application.port.out.GeneratePresignedUrlPort;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
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

    private static final String TOPIC_RESUME_UPLOADED =
            "resume.uploaded"; // Should match Python consumer config

    @Override
    @Transactional
    public void execute(CompleteUploadCommand command) {
        // 1. Load Resume
        Resumes resume =
                loadResumePort
                        .loadResumeById(command.getResumeId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Resume not found: " + command.getResumeId()));

        try {
            // 2. Generate Download URL for the Document Service
            String downloadUrl = generatePresignedUrlPort.generateDownloadUrl(resume.getFilePath());

            // 3. Update Status to PROCESSING
            resume.startProcessing();
            saveResumePort.save(resume);

            // 4. Publish Event to Kafka
            ResumeUploadedEvent event =
                    new ResumeUploadedEvent(
                            resume.getId().toString(),
                            resume.getFilePath(),
                            downloadUrl,
                            command.getValidationText());

            // Using ID as key for partitioning order
            kafkaTemplate.send(TOPIC_RESUME_UPLOADED, resume.getId().toString(), event);

            // 5. Save Embedding if provided by Frontend (Same-Source Strategy)
            if (command.getEmbedding() != null && command.getEmbedding().length > 0) {
                log.info("Saving frontend-provided embedding for resume: {}", resume.getId());
                resumeVectorService.saveEmbedding(
                        resume.getUser().getId(),
                        resume.getId().toString(),
                        command.getValidationText() != null ? command.getValidationText() : "",
                        command.getEmbedding(),
                        "VALIDATION");
            }

            log.info(
                    "Resume upload completed. Event published to Kafka: resumeId={}, validationTextPresent={}, embeddingPresent={}",
                    resume.getId(),
                    command.getValidationText() != null && !command.getValidationText().isEmpty(),
                    command.getEmbedding() != null);

        } catch (Exception e) {
            log.error("Failed to complete upload process: {}", e.getMessage());
            resume.failProcessing();
            saveResumePort.save(resume);
            throw e;
        }
    }
}
