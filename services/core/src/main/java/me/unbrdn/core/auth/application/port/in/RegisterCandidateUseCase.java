package me.unbrdn.core.auth.application.port.in;

import java.util.UUID;
import me.unbrdn.core.auth.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterCandidateCommand;

public interface RegisterCandidateUseCase {
    /**
     * 면접자 회원가입
     *
     * @param command 회원가입 명령 (이메일, 비밀번호, 닉네임, 전화번호)
     * @return 생성된 사용자 ID
     * @throws UserAlreadyExistsException 이미 존재하는 이메일인 경우
     */
    UUID execute(RegisterCandidateCommand command);
}
