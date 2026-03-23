package me.unbrdn.core.resume.application.dto;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CompleteUploadCommand {
    private final UUID resumeId;
    private final String validationText;
    private final float[] embedding;
    private final UUID existingResumeId; // 업데이트 시 대체할 기존 이력서 ID
}
