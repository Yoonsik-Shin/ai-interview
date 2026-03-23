package me.unbrdn.core.resume.application.port.in;

import java.util.Map;
import java.util.UUID;

public interface GetResumeEmbeddingsUseCase {
    Map<UUID, float[]> execute(UUID userId);
}
