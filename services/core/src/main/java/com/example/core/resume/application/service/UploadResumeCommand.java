package com.example.core.resume.application.service;

import lombok.Builder;
import lombok.Getter;

/**
 * 이력서 업로드 명령 DTO
 */
@Getter
@Builder
public class UploadResumeCommand {

  private final Long userId;
  private final String title;
  private final byte[] fileData;
  private final String fileName;
  private final String contentType;
}

