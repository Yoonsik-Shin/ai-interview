package me.unbrdn.core.resume.application.service;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.resume.application.dto.ResumeDetailDto;
import me.unbrdn.core.resume.application.port.in.GetResumeUseCase;
import me.unbrdn.core.resume.application.port.out.GeneratePresignedUrlPort;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetResumeInteractor implements GetResumeUseCase {

    private final LoadResumePort loadResumePort;
    private final GeneratePresignedUrlPort generatePresignedUrlPort;

    @Override
    @Transactional(readOnly = true)
    public Optional<ResumeDetailDto> execute(UUID resumeId, UUID userId) {
        return loadResumePort
                .loadResumeById(resumeId)
                .filter(r -> r.getUser().getId().equals(userId))
                .map(
                        r -> {
                            String fileUrl =
                                    r.getFilePath() != null
                                            ? generatePresignedUrlPort.generateDownloadUrl(
                                                    r.getFilePath(), false)
                                            : "";
                            return ResumeDetailDto.builder()
                                    .id(r.getId())
                                    .title(r.getTitle())
                                    .content(r.getContent() != null ? r.getContent() : "")
                                    .status(r.getStatus().name())
                                    .createdAt(r.getCreatedAt())
                                    .fileUrl(fileUrl)
                                    .build();
                        });
    }
}
