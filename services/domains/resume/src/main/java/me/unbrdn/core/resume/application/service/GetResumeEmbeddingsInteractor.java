package me.unbrdn.core.resume.application.service;

import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.port.in.GetResumeEmbeddingsUseCase;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetResumeEmbeddingsInteractor implements GetResumeEmbeddingsUseCase {

    private final ResumeVectorService resumeVectorService;

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, float[]> execute(UUID userId) {
        return resumeVectorService.getEmbeddingsByUserId(userId);
    }
}
