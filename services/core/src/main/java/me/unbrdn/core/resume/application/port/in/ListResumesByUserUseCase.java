package me.unbrdn.core.resume.application.port.in;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.resume.application.dto.ResumeItemDto;

public interface ListResumesByUserUseCase {
    List<ResumeItemDto> execute(UUID userId);
}
