package me.unbrdn.core.resume.application.port.in;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.resume.application.dto.ResumeDetailDto;

public interface GetResumeUseCase {
    Optional<ResumeDetailDto> execute(UUID resumeId, UUID userId);
}
