package me.unbrdn.core.user.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.user.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.user.application.interactor.dto.command.RegisterCandidateCommand;
import me.unbrdn.core.user.application.interactor.dto.result.RegisterCandidateResult;
import me.unbrdn.core.user.application.port.in.RegisterCandidateUseCase;
import me.unbrdn.core.user.application.port.out.UserPort;
import me.unbrdn.core.user.application.service.UserRegistrationValidator;
import me.unbrdn.core.user.domain.entity.Candidate;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("userRegisterCandidateInteractor")
@RequiredArgsConstructor
public class RegisterCandidateInteractor implements RegisterCandidateUseCase {

    private final UserPort userPort;
    private final PasswordEncoder passwordEncoder;
    private final UserRegistrationValidator validator;

    @Override
    @Transactional
    public RegisterCandidateResult execute(RegisterCandidateCommand command) {
        validator.validateRegistration(
                command.getEmail(),
                command.getPassword(),
                command.getNickname(),
                command.getPhoneNumber());

        if (userPort.loadByEmail(command.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException("이미 존재하는 이메일입니다: " + command.getEmail());
        }
        if (userPort.loadByNickname(command.getNickname()).isPresent()) {
            throw new UserAlreadyExistsException("이미 사용 중인 닉네임입니다: " + command.getNickname());
        }

        Candidate candidate =
                Candidate.createWithRawPassword(
                        command.getEmail(),
                        command.getPassword(),
                        command.getNickname(),
                        command.getPhoneNumber(),
                        passwordEncoder);

        User savedUser = userPort.save(candidate);
        return RegisterCandidateResult.builder().userId(savedUser.getId()).build();
    }
}
