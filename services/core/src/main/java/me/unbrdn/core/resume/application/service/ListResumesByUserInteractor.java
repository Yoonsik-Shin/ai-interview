package me.unbrdn.core.resume.application.service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.resume.application.dto.ResumeItemDto;
import me.unbrdn.core.resume.application.port.in.ListResumesByUserUseCase;
import me.unbrdn.core.resume.application.port.out.LoadResumesByUserPort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListResumesByUserInteractor implements ListResumesByUserUseCase {

    private final LoadResumesByUserPort loadResumesByUserPort;

    @Override
    @Transactional(readOnly = true)
    public List<ResumeItemDto> execute(UUID userId) {
        List<Resumes> resumes = loadResumesByUserPort.loadResumesByUserId(userId);
        return resumes.stream()
                .map(r -> ResumeItemDto.builder()
                        .id(r.getId())
                        .title(r.getTitle())
                        .status(r.getStatus().name())
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }
}
