package me.unbrdn.core.resume.application.port.out;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.resume.domain.entity.Resumes;

public interface LoadResumePort {
    Optional<Resumes> loadResumeById(UUID id);
}
