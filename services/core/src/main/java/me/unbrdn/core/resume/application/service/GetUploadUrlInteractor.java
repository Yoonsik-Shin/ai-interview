package me.unbrdn.core.resume.application.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.common.infrastructure.id.UuidHolder;
import me.unbrdn.core.resume.application.dto.GetUploadUrlCommand;
import me.unbrdn.core.resume.application.dto.GetUploadUrlResult;
import me.unbrdn.core.resume.application.exception.UserNotFoundException;
import me.unbrdn.core.resume.application.port.in.GetUploadUrlUseCase;
import me.unbrdn.core.resume.application.port.out.GeneratePresignedUrlPort;
import me.unbrdn.core.resume.application.port.out.LoadUserPort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetUploadUrlInteractor implements GetUploadUrlUseCase {

    private final LoadUserPort loadUserPort;
    private final SaveResumePort saveResumePort;
    private final GeneratePresignedUrlPort generatePresignedUrlPort;

    @Override
    @Transactional
    public GetUploadUrlResult execute(GetUploadUrlCommand command) {
        // 1. 사용자 조회
        User user =
                loadUserPort
                        .loadUserById(command.getUserId())
                        .orElseThrow(
                                () ->
                                        new UserNotFoundException(
                                                "사용자를 찾을 수 없습니다. ID: " + command.getUserId()));

        // 2. Resume ID 미리 생성 (Object Key와 맞추기 위함)
        UUID resumeId = UuidHolder.generate();
        String objectKey =
                String.format(
                        "resumes/%s/%s_%s", command.getUserId(), resumeId, command.getFileName());

        // 3. Presigned URL 생성 요청
        String uploadUrl = generatePresignedUrlPort.generateUploadUrl(objectKey);
        if (uploadUrl == null) {
            log.error(
                    "Presigned URL 생성 실패: userId={}, fileName={}",
                    command.getUserId(),
                    command.getFileName());
            throw new RuntimeException("업로드 URL 생성에 실패했습니다.");
        }

        // 4. Resume 메타데이터 저장 (PENDING)
        Resumes resume = Resumes.create(user, command.getTitle(), objectKey, null);
        resume.setId(resumeId);
        saveResumePort.save(resume);

        log.info("이력서 업로드 URL 발급 완료: resumeId={}, userId={}", resumeId, command.getUserId());

        return GetUploadUrlResult.builder()
                .uploadUrl(uploadUrl)
                .resumeId(resumeId.toString())
                .build();
    }
}
