package me.unbrdn.core.resume.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidateResumeResult {
    private boolean isResume;
    private String reason;
    private float score;
}
