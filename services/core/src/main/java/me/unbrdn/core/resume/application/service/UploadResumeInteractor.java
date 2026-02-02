package me.unbrdn.core.resume.application.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.exception.UserNotFoundException;
import me.unbrdn.core.resume.application.port.in.UploadResumeUseCase;
import me.unbrdn.core.resume.application.port.out.LoadUserPort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.resume.domain.service.DocumentParser;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이력서 업로드 UseCase 구현체 (Interactor)
 *
 * <p>비즈니스 로직: 1. 사용자 조회 2. 문서에서 텍스트 추출 (Apache Tika) 3. 이력서 저장
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
    public UUID execute(UploadResumeCommand command) {
        // 1. 사용자 조회
        User user =
                loadUserPort
                        .loadById(command.getUserId())
                        .orElseThrow(
                                () ->
                                        new UserNotFoundException(
                                                "사용자를 찾을 수 없습니다. ID: " + command.getUserId()));

        // 2. 문서에서 텍스트 추출
        String extractedText =
                documentParser.extractText(command.getFileData(), command.getContentType());
        log.info(
                "이력서 텍스트 추출 완료: userId={}, textLength={}",
                command.getUserId(),
                extractedText.length());

        // 3. 이력서 생성 및 저장
        Resumes resume = Resumes.create(user, command.getTitle(), extractedText);
        Resumes savedResume = saveResumePort.save(resume);

        log.info("이력서 저장 완료: resumeId={}, userId={}", savedResume.getId(), command.getUserId());
        return savedResume.getId();
    }
}
