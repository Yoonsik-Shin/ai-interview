package me.unbrdn.core.resume.application.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.adapter.out.grpc.DocumentGrpcClient;
import me.unbrdn.core.resume.application.dto.UploadResumeResult;
import me.unbrdn.core.resume.application.exception.UserNotFoundException;
import me.unbrdn.core.resume.application.port.in.UploadResumeUseCase;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
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
    private final LoadResumePort loadResumePort;
    private final DocumentParser documentParser;
    private final ResumeVectorService resumeVectorService;
    private final DocumentGrpcClient documentGrpcClient;

    @Override
    @Transactional
    public UploadResumeResult execute(UploadResumeCommand command) {
        // 1. 사용자 조회
        User user =
                loadUserPort
                        .loadUserById(command.getUserId())
                        .orElseThrow(
                                () ->
                                        new UserNotFoundException(
                                                "사용자를 찾을 수 없습니다. ID: " + command.getUserId()));

        // 2. 해시 계산 및 중복 체크 (Exact Match)
        String fileHash = calculateHash(command.getFileData());
        loadResumePort
                .loadByUserIdAndFileHash(user.getId(), fileHash)
                .ifPresent(
                        r -> {
                            throw new me.unbrdn.core.resume.application.exception
                                    .DuplicateResumeException("이미 등록된 동일한 이력서가 존재합니다.");
                        });

        // 3. 문서에서 텍스트 추출
        String extractedText =
                documentParser.extractText(command.getFileData(), command.getContentType());
        log.info(
                "이력서 텍스트 추출 완료: userId={}, textLength={}",
                command.getUserId(),
                extractedText.length());

        // 4. 의미론적 유사도 검증 (forceUpload가 아닌 경우에만)
        String textForEmbedding =
                (command.getValidationText() != null && !command.getValidationText().isEmpty())
                        ? command.getValidationText()
                        : extractedText;

        // 임베딩 생성 (프론트엔드 제공 데이터 우선, 없을 경우에만 백엔드 생성)
        String truncatedText =
                textForEmbedding.length() > 3000
                        ? textForEmbedding.substring(0, 3000)
                        : textForEmbedding;

        float[] embedding =
                (command.getEmbedding() != null && command.getEmbedding().length > 0)
                        ? command.getEmbedding()
                        : documentGrpcClient.generateEmbedding(truncatedText);

        if (!command.isForceUpload()) {
            var similarResume =
                    resumeVectorService.findSimilarResume(user.getId(), embedding, 0.85);
            if (similarResume.isPresent()) {
                log.info(
                        "유사 이력서 발견 - 사용자 확인 필요: userId={}, similarity={}",
                        user.getId(),
                        similarResume.get().similarity());
                return UploadResumeResult.withSimilarResume(similarResume.get());
            }
        }

        // 5. 이력서 생성 및 저장 (Legacy: 직접 텍스트 추출 방식)
        String dummyFilePath = "legacy/" + UUID.randomUUID() + "_" + command.getFileName();
        Resumes resume = Resumes.create(user, command.getTitle(), dummyFilePath, fileHash);

        resume.completeProcessing(extractedText, "[]"); // legacy는 이미지 추출 없음

        Resumes savedResume = saveResumePort.save(resume);

        // 6. 임베딩 저장 (Spring AI VectorStore)
        resumeVectorService.saveEmbedding(
                user.getId(),
                savedResume.getId().toString(),
                extractedText,
                embedding,
                "VALIDATION"); // category를 VALIDATION으로 통일

        log.info("이력서 저장 완료: resumeId={}, userId={}", savedResume.getId(), command.getUserId());
        return UploadResumeResult.success(savedResume.getId().toString());
    }

    private String calculateHash(byte[] data) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }
}
