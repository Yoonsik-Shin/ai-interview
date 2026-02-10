package me.unbrdn.core.resume.application.service;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UpdateResumeCommand {
    private final UUID userId;
    private final UUID existingResumeId; // 업데이트할 기존 이력서 ID
    private final String title;
    private final byte[] fileData;
    private final String fileName;
    private final String contentType;
    private final float[] embedding;
}
