package me.unbrdn.core.resume.application.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.adapter.out.grpc.DocumentGrpcClient;
import me.unbrdn.core.resume.application.exception.ResumeNotFoundException;
import me.unbrdn.core.resume.application.exception.UserNotFoundException;
import me.unbrdn.core.resume.application.port.in.UpdateResumeUseCase;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.LoadUserPort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.resume.domain.service.DocumentParser;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이력서 업데이트 UseCase 구현체 (Interactor)
 *
 * <p>비즈니스 로직: 1. 기존 이력서 조회 2. 기존 임베딩 삭제 3. 새 파일로 업데이트 4. 새 임베딩 저장
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UpdateResumeInteractor implements UpdateResumeUseCase {

    private final LoadUserPort loadUserPort;
    private final LoadResumePort loadResumePort;
    private final SaveResumePort saveResumePort;
    private final DocumentParser documentParser;
    private final ResumeVectorService resumeVectorService;
    private final DocumentGrpcClient documentGrpcClient;

    @Override
    @Transactional
    public UUID execute(UpdateResumeCommand command) {
        // 1. 사용자 조회
        User user =
                loadUserPort
                        .loadUserById(command.getUserId())
                        .orElseThrow(
                                () ->
                                        new UserNotFoundException(
                                                "사용자를 찾을 수 없습니다. ID: " + command.getUserId()));

        // 2. 기존 이력서 조회
        Resumes existingResume =
                loadResumePort
                        .loadResumeById(command.getExistingResumeId())
                        .orElseThrow(
                                () ->
                                        new ResumeNotFoundException(
                                                "이력서를 찾을 수 없습니다. ID: "
                                                        + command.getExistingResumeId()));

        // 3. 권한 확인 (본인의 이력서인지)
        if (!existingResume.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("본인의 이력서만 업데이트할 수 있습니다.");
        }

        // 4. 기존 임베딩 삭제
        resumeVectorService.deleteByResumeId(existingResume.getId().toString());
        log.info("기존 임베딩 삭제 완료: resumeId={}", existingResume.getId());

        // 5. 새 파일에서 텍스트 추출
        String extractedText =
                documentParser.extractText(command.getFileData(), command.getContentType());
        log.info(
                "이력서 텍스트 추출 완료: resumeId={}, textLength={}",
                existingResume.getId(),
                extractedText.length());

        // 6. 새 임베딩 생성 (프론트엔드 제공 데이터 우선, 없을 경우에만 백엔드 생성)
        float[] embedding =
                (command.getEmbedding() != null && command.getEmbedding().length > 0)
                        ? command.getEmbedding()
                        : documentGrpcClient.generateEmbedding(extractedText);

        // 7. 이력서 업데이트
        String newFilePath = "legacy/" + UUID.randomUUID() + "_" + command.getFileName();
        existingResume.updateContent(command.getTitle(), newFilePath, extractedText);

        Resumes updatedResume = saveResumePort.save(existingResume);

        // 8. 새 임베딩 저장
        resumeVectorService.saveEmbedding(
                user.getId(),
                updatedResume.getId().toString(),
                extractedText,
                embedding,
                "VALIDATION"); // category를 VALIDATION으로 통일

        log.info("이력서 업데이트 완료: resumeId={}, userId={}", updatedResume.getId(), user.getId());
        return updatedResume.getId();
    }
}
