package me.unbrdn.core.user.application.interactor.dto.result;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RegisterRecruiterResult {
    private final UUID userId;
}
