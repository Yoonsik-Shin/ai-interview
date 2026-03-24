package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.command.CreateInterviewCommand;
import me.unbrdn.core.interview.application.dto.result.CreateInterviewResult;
import me.unbrdn.core.interview.application.exception.ResumeNotFoundException;
import me.unbrdn.core.interview.application.exception.UserNotFoundException;
import me.unbrdn.core.interview.application.port.in.CreateInterviewUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.LoadResumePort;
import me.unbrdn.core.interview.application.port.out.LoadUserPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateInterviewInteractor implements CreateInterviewUseCase {

    private final LoadUserPort loadUserPort;
    private final LoadResumePort loadResumePort;
    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;

    @Override
    @Transactional
    public CreateInterviewResult execute(CreateInterviewCommand command) {
        if (!loadUserPort.isCandidate(command.getUserId())) {
            throw new UserNotFoundException(
                    "사용자가 면접자(Candidate)가 아닙니다. ID: " + command.getUserId());
        }

        UUID resumeId = command.getResumeId().orElse(null);
        if (resumeId != null && !loadResumePort.exists(resumeId)) {
            throw new ResumeNotFoundException("이력서를 찾을 수 없습니다. ID: " + resumeId);
        }

        InterviewType interviewType =
                command.getType() == null
                        ? InterviewType.PRACTICE
                        : InterviewType.valueOf(command.getType());

        List<String> participatingPersonas =
                command.getRoles() == null || command.getRoles().isEmpty()
                        ? List.of("TECH")
                        : new java.util.ArrayList<>(command.getRoles());

        String interviewId = UUID.randomUUID().toString();

        InterviewSession interviewSession =
                InterviewSession.create(
                        interviewId,
                        command.getUserId(),
                        resumeId,
                        command.getCompanyName(),
                        interviewType,
                        command.getDomain(),
                        command.getScheduledDurationMinutes(),
                        participatingPersonas);

        InterviewSession savedSession = interviewPort.save(interviewSession);

        InterviewSessionState initialState =
                InterviewSessionState.builder()
                        .currentDifficulty(3)
                        .lastInterviewerId("LEADER")
                        .turnCount(0)
                        .remainingTimeSeconds(command.getScheduledDurationMinutes() * 60L)
                        .selfIntroRetryCount(0)
                        .participatingPersonas(participatingPersonas)
                        .nextPersonaIndex(0)
                        .build();
        sessionStatePort.saveState(savedSession.getId().toString(), initialState);

        return CreateInterviewResult.builder()
                .interviewId(savedSession.getId())
                .status(savedSession.getStatus())
                .build();
    }
}
