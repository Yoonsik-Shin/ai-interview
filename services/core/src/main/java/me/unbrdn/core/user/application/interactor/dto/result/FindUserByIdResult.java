package me.unbrdn.core.user.application.interactor.dto.result;

import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.user.domain.entity.User;

@Getter
@Builder
public class FindUserByIdResult {
    private final User user;
}
