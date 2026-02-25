package me.unbrdn.core.interview.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.adapter.out.persistence.ResumeMapper;
import me.unbrdn.core.resume.adapter.out.persistence.repository.ResumeJpaRepository;
import me.unbrdn.core.resume.domain.entity.Resumes;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewResumePersistenceAdapter implements LoadResumePort {

    private final ResumeJpaRepository resumesRepository;
    private final ResumeMapper resumeMapper;

    @Override
    public Optional<Resumes> loadById(UUID resumeId) {
        return resumesRepository.findById(resumeId).map(resumeMapper::toDomain);
    }
}
