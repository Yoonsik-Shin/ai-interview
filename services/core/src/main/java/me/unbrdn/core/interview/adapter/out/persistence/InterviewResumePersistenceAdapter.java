package me.unbrdn.core.interview.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.resume.domain.repository.ResumesRepository;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewResumePersistenceAdapter implements LoadResumePort {

    private final ResumesRepository resumesRepository;

    @Override
    public Optional<Resumes> loadById(UUID resumeId) {
        return resumesRepository.findById(resumeId);
    }
}
