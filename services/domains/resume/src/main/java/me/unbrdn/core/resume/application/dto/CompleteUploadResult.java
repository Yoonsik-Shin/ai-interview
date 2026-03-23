package me.unbrdn.core.resume.application.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CompleteUploadResult {
    private boolean success;
    private ResumeDetailDto resume;
}
