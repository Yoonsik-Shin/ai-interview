package me.unbrdn.core.resume.application.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GetUploadUrlResult {
    private final String uploadUrl;
    private final String resumeId;
}
