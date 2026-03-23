package me.unbrdn.core.resume.application.dto;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ResumeItemDto {
    private UUID id;
    private String title;
    private String status;
    private Instant createdAt;
    private float[] embedding;
}
