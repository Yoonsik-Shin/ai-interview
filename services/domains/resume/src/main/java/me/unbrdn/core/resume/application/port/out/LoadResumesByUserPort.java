package me.unbrdn.core.resume.application.port.out;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.resume.domain.entity.Resumes;

public interface LoadResumesByUserPort {
    List<Resumes> loadResumesByUserId(UUID userId);
}
