package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.in.ListInterviewsUseCase;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.repository.InterviewSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ListInterviewsInteractor implements ListInterviewsUseCase {

    private final InterviewSessionRepository interviewSessionRepository;

    @Override
    public List<ListInterviewsUseCase.InterviewSummary> execute(UUID userId) {
        return interviewSessionRepository.findByCandidate_IdOrderByStartedAtDesc(userId).stream()
                .map(this::mapToSummary)
                .toList();
    }

    private ListInterviewsUseCase.InterviewSummary mapToSummary(InterviewSession session) {
        return ListInterviewsUseCase.InterviewSummary.builder()
                .interviewId(UUID.fromString(session.getSessionUuid()))
                .startedAt(session.getStartedAt())
                .status(session.getStatus())
                .domain(session.getDomain())
                .type(session.getType())
                .targetDurationMinutes(session.getTargetDurationMinutes())
                .interviewerCount(session.getInterviewerCount())
                .build();
    }
}
