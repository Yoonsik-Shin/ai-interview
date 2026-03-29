package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewMessageJpaRepository;
import me.unbrdn.core.interview.application.port.in.GetInterviewHistoryUseCase;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Interactor for retrieving interview history */
@Slf4j
@Service
@RequiredArgsConstructor
public class GetInterviewHistoryInteractor implements GetInterviewHistoryUseCase {

    private final InterviewMessageJpaRepository messageJpaRepository;

    @Override
    @Transactional(readOnly = true)
    public List<InterviewMessageDto> execute(String interviewId) {
        log.info("Executing GetInterviewHistory: interviewId={}", interviewId);

        List<InterviewMessageJpaEntity> entities =
                messageJpaRepository.findByInterview_IdOrderByCreatedAtAsc(
                        UUID.fromString(interviewId));

        return entities.stream().map(this::toDto).collect(Collectors.toList());
    }

    private InterviewMessageDto toDto(InterviewMessageJpaEntity entity) {
        return new InterviewMessageDto(
                entity.getRole() != null ? entity.getRole().name() : "",
                "",
                entity.getContent(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null,
                Map.of());
    }
}
