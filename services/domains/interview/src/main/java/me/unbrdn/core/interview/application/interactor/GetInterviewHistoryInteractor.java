package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.adapter.out.mongodb.entity.InterviewMessageDocument;
import me.unbrdn.core.interview.application.port.in.GetInterviewHistoryUseCase;
import me.unbrdn.core.interview.application.port.out.LoadInterviewHistoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Interactor for retrieving interview history */
@Slf4j
@Service
@RequiredArgsConstructor
public class GetInterviewHistoryInteractor implements GetInterviewHistoryUseCase {

    private final LoadInterviewHistoryPort loadHistoryPort;

    @Override
    @Transactional(readOnly = true)
    public List<InterviewMessageDto> execute(String interviewId) {
        log.info("Executing GetInterviewHistory: interviewId={}", interviewId);

        // TODO: Add authorization check (verify user owns this interview)
        // This will be implemented when we add security context

        List<InterviewMessageDocument> documents = loadHistoryPort.loadHistory(interviewId);

        return documents.stream().map(this::toDto).collect(Collectors.toList());
    }

    private InterviewMessageDto toDto(InterviewMessageDocument doc) {
        return new InterviewMessageDto(
                doc.getRole(),
                doc.getType(),
                doc.getContent(),
                doc.getTimestamp() != null ? doc.getTimestamp().toString() : null,
                doc.getPayload());
    }
}
