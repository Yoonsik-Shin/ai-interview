package me.unbrdn.core.auth.application.interactor.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RegisterCandidateCommand {
    private final String email;
    private final String password;
    private final String nickname;
    private final String phoneNumber;
}
