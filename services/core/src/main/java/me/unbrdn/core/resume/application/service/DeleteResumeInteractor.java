package me.unbrdn.core.resume.application.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.port.in.DeleteResumeUseCase;
import me.unbrdn.core.resume.application.port.out.DeleteFilePort;
import me.unbrdn.core.resume.application.port.out.DeleteResumePort;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeleteResumeInteractor implements DeleteResumeUseCase {

    private final LoadResumePort loadResumePort;
    private final DeleteResumePort deleteResumePort;
    private final DeleteFilePort deleteFilePort;
    private final ResumeVectorService resumeVectorService;

    @Override
    @Transactional
    public boolean deleteResume(String resumeId, String userId) {
        log.info("Deleting resume: {} for user: {}", resumeId, userId);

        return loadResumePort
                .loadResumeById(UUID.fromString(resumeId))
                .map(
                        resume -> {
                            // 권한 체크: 본인의 이력서만 삭제 가능
                            if (!resume.getUser().getId().toString().equals(userId)) {
                                log.warn(
                                        "User {} tried to delete resume {} belonging to {}",
                                        userId,
                                        resumeId,
                                        resume.getUser().getId());
                                return false;
                            }

                            // 1. 스토리지에서 파일 삭제 (filePath가 있는 경우)
                            String filePath = resume.getFilePath();
                            if (filePath != null && !filePath.isEmpty()) {
                                try {
                                    deleteFilePort.deleteFile(filePath);
                                } catch (Exception e) {
                                    // 파일 삭제 실패는 로그만 남기고 DB 삭제는 진행 (S3가 비동기로 지워질 수도 있고, 정합성 완화 가능)
                                    log.error(
                                            "Failed to delete file from storage: {}", filePath, e);
                                }
                            }

                            // 2. 임베딩 데이터 삭제 (Vector Store)
                            try {
                                resumeVectorService.deleteByResumeId(resumeId);
                            } catch (Exception e) {
                                log.error(
                                        "Failed to delete embeddings for resume: {}", resumeId, e);
                                // 임베딩 삭제 실패해도 진행 (나중에 배치로 지우든 함)
                            }

                            // 3. DB 레코드 삭제 (Cascade로 임베딩 등도 같이 지워질 것임)
                            deleteResumePort.deleteById(resumeId);

                            log.info("Successfully deleted resume: {}", resumeId);
                            return true;
                        })
                .orElseGet(
                        () -> {
                            log.warn("Resume not found: {}", resumeId);
                            return false;
                        });
    }
}
