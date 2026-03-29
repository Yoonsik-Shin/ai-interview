package me.unbrdn.core.user.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.user.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.user.application.interactor.dto.command.RegisterRecruiterCommand;
import me.unbrdn.core.user.application.interactor.dto.result.RegisterRecruiterResult;
import me.unbrdn.core.user.application.port.in.RegisterRecruiterUseCase;
import me.unbrdn.core.user.application.port.out.UserPort;
import me.unbrdn.core.user.application.service.UserRegistrationValidator;
import me.unbrdn.core.user.domain.entity.Recruiter;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service("userRegisterRecruiterInteractor")
@RequiredArgsConstructor
public class RegisterRecruiterInteractor implements RegisterRecruiterUseCase {

    private final UserPort userPort;
    private final PasswordEncoder passwordEncoder;
    private final UserRegistrationValidator validator;

    @Override
    @Transactional
    public RegisterRecruiterResult execute(RegisterRecruiterCommand command) {
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

        Recruiter recruiter =
                Recruiter.createWithRawPassword(
                        command.getEmail(),
                        command.getPassword(),
                        command.getNickname(),
                        command.getCompanyCode(),
                        command.getPhoneNumber(),
                        passwordEncoder);

        User savedUser = userPort.save(recruiter);
        return RegisterRecruiterResult.builder().userId(savedUser.getId()).build();
    }
}
