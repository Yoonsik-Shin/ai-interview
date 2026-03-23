package me.unbrdn.core.resume.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.dto.ValidateResumeCommand;
import me.unbrdn.core.resume.application.dto.ValidateResumeResult;
import me.unbrdn.core.resume.application.port.in.ValidateResumeUseCase;
import me.unbrdn.core.resume.application.port.out.ValidateResumePort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ValidateResumeInteractor implements ValidateResumeUseCase {

    private final ValidateResumePort validateResumePort;

    @Override
    public ValidateResumeResult execute(ValidateResumeCommand command) {
        log.info("이력서 내용 유효성 검사 시작 (LLM)");
        return validateResumePort.validateResume(command.getText());
    }
}
