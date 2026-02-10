package me.unbrdn.core.resume.application.service;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

/** 이력서 업로드 명령 DTO */
@Getter
@Builder
public class UploadResumeCommand {

    private final UUID userId;
    private final String title;
    private final byte[] fileData;
    private final String fileName;
    private final String contentType;
    private final boolean forceUpload; // 유사도 검증 스킵 여부
    private final String validationText;
    private final float[] embedding;
}
