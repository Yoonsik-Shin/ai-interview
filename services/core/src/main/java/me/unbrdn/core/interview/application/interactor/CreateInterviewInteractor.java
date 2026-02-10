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
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.user.domain.entity.Candidate;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateInterviewInteractor implements CreateInterviewUseCase {

    private final LoadUserPort loadUserPort;
    private final LoadResumePort loadResumePort;
    private final InterviewPort interviewPort;

    @Override
    @Transactional
    public CreateInterviewResult execute(CreateInterviewCommand command) {
        User user =
                loadUserPort
                        .loadById(command.getUserId())
                        .orElseThrow(
                                () ->
                                        new UserNotFoundException(
                                                "사용자를 찾을 수 없습니다. ID: " + command.getUserId()));

        if (!(user instanceof Candidate candidate)) {
            throw new UserNotFoundException(
                    "사용자가 면접자(Candidate)가 아닙니다. ID: " + command.getUserId());
        }

        // resumeId가 있을 때만 이력서 조회, 없으면 null
        Resumes resume =
                command.getResumeId()
                        .map(
                                resumeId ->
                                        loadResumePort
                                                .loadById(resumeId)
                                                .orElseThrow(
                                                        () ->
                                                                new ResumeNotFoundException(
                                                                        "이력서를 찾을 수 없습니다. ID: "
                                                                                + resumeId)))
                        .orElse(null);

        InterviewType interviewType =
                command.getType() == null ? InterviewType.PRACTICE : command.getType();

        // Fallback or use provided
        List<InterviewRole> roles =
                command.getRoles() == null || command.getRoles().isEmpty()
                        ? List.of(InterviewRole.TECH)
                        : command.getRoles();

        InterviewPersonality personality =
                command.getPersonality() == null
                        ? InterviewPersonality.COMFORTABLE
                        : command.getPersonality();

        String sessionUuid = UUID.randomUUID().toString();

        InterviewSession interviewSession =
                InterviewSession.create(
                        sessionUuid,
                        candidate,
                        resume,
                        roles,
                        personality,
                        interviewType,
                        command.getDomain(),
                        command.getInterviewerCount(),
                        command.getTargetDurationMinutes(),
                        command.getSelfIntroduction());

        InterviewSession savedSession = interviewPort.save(interviewSession);

        return CreateInterviewResult.builder()
                .interviewId(savedSession.getId())
                .status(savedSession.getStatus())
                .build();
    }
}
