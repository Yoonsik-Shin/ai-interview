package me.unbrdn.core.interview.adapter.out.persistence;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewResultCommand;
import me.unbrdn.core.interview.application.port.out.SaveInterviewResultPort;
import me.unbrdn.core.interview.domain.entity.InterviewResult;
import me.unbrdn.core.interview.domain.repository.InterviewResultRepository;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewResultPersistenceAdapter implements SaveInterviewResultPort {

    private final InterviewResultRepository repository;

    @Override
    public void save(SaveInterviewResultCommand command) {
        InterviewResult entity =
                InterviewResult.builder()
                        .interviewId(command.getInterviewId())
                        .userId(command.getUserId())
                        .userAnswer(command.getUserAnswer())
                        .aiAnswer(command.getAiAnswer())
                        .createdAt(Instant.now())
                        .build();

        repository.save(entity);
    }
}
