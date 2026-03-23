package me.unbrdn.core.user.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.user.application.interactor.dto.command.FindUserByEmailCommand;
import me.unbrdn.core.user.application.interactor.dto.result.FindUserByEmailResult;
import me.unbrdn.core.user.application.port.in.FindUserByEmailUseCase;
import me.unbrdn.core.user.application.port.out.UserPort;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FindUserByEmailInteractor implements FindUserByEmailUseCase {

    private final UserPort userPort;

    @Override
    public FindUserByEmailResult execute(FindUserByEmailCommand command) {
        User user =
                userPort.loadByEmail(command.getEmail())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "존재하지 않는 이메일입니다: " + command.getEmail()));
        return FindUserByEmailResult.builder().user(user).build();
    }
}
