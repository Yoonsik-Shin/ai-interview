package me.unbrdn.core.user.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.user.application.interactor.dto.command.FindUserByIdCommand;
import me.unbrdn.core.user.application.interactor.dto.result.FindUserByIdResult;
import me.unbrdn.core.user.application.port.in.FindUserByIdUseCase;
import me.unbrdn.core.user.application.port.out.UserPort;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FindUserByIdInteractor implements FindUserByIdUseCase {

    private final UserPort userPort;

    @Override
    public FindUserByIdResult execute(FindUserByIdCommand command) {
        User user = userPort.loadById(command.getUserId()).orElse(null);
        return FindUserByIdResult.builder().user(user).build();
    }
}
