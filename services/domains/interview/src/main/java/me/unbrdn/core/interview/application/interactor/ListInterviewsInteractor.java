package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.in.ListInterviewsUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ListInterviewsInteractor implements ListInterviewsUseCase {

    private final InterviewPort interviewPort;

    @Override
    public List<ListInterviewsUseCase.InterviewSummary> execute(ListInterviewsCommand command) {
        List<InterviewSession> sessions;
        if (command.status() != null && !command.status().isEmpty()) {
            sessions =
                    interviewPort.findAllByUserIdAndStatus(
                            command.userId(),
                            command.status(),
                            command.limit() != null ? command.limit() : 0);
        } else {
            sessions = interviewPort.findByCandidateId(command.userId());
            if (command.limit() != null && command.limit() > 0) {
                sessions = sessions.stream().limit(command.limit()).toList();
            }
        }
        return sessions.stream().map(this::mapToSummary).toList();
    }

    private ListInterviewsUseCase.InterviewSummary mapToSummary(InterviewSession session) {
        return ListInterviewsUseCase.InterviewSummary.builder()
                .interviewId(session.getId())
                .startedAt(session.getStartedAt())
                .status(session.getStatus())
                .companyName(session.getCompanyName())
                .domain(session.getDomain())
                .type(session.getType())
                .scheduledDurationMinutes(session.getScheduledDurationMinutes())
                .jobPostingUrl(session.getJobPostingUrl())
                .build();
    }
}
