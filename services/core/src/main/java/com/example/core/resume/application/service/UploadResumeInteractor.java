package com.example.core.resume.application.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.core.domain.entity.Resumes;
import com.example.core.domain.entity.Users;
import com.example.core.resume.application.exception.UserNotFoundException;
import com.example.core.resume.application.port.in.UploadResumeUseCase;
import com.example.core.resume.application.port.out.LoadUserPort;
import com.example.core.resume.application.port.out.SaveResumePort;
import com.example.core.resume.domain.service.DocumentParser;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 이력서 업로드 UseCase 구현체 (Interactor)
 * 
 * 비즈니스 로직:
 * 1. 사용자 조회
 * 2. 문서에서 텍스트 추출 (Apache Tika)
 * 3. 이력서 저장
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UploadResumeInteractor implements UploadResumeUseCase {

  private final LoadUserPort loadUserPort;
  private final SaveResumePort saveResumePort;
  private final DocumentParser documentParser;

  @Override
  @Transactional
  public Long execute(UploadResumeCommand command) {
    // 1. 사용자 조회
    Users user = loadUserPort.loadById(command.getUserId())
        .orElseThrow(() -> new UserNotFoundException("사용자를 찾을 수 없습니다. ID: " + command.getUserId()));

    // 2. 문서에서 텍스트 추출
    String extractedText = documentParser.extractText(command.getFileData(), command.getContentType());
    log.info("이력서 텍스트 추출 완료: userId={}, textLength={}", command.getUserId(), extractedText.length());

    // 3. 이력서 생성 및 저장
    Resumes resume = Resumes.create(user, command.getTitle(), extractedText);
    Resumes savedResume = saveResumePort.save(resume);

    log.info("이력서 저장 완료: resumeId={}, userId={}", savedResume.getResumeId(), command.getUserId());
    return savedResume.getResumeId();
  }
}

