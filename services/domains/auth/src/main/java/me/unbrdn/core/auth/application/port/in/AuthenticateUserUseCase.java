package me.unbrdn.core.auth.application.port.in;

import me.unbrdn.core.auth.application.exception.AuthenticationException;
import me.unbrdn.core.auth.application.interactor.dto.command.AuthenticateUserCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticateUserResult;

/** 사용자 인증 */
public interface AuthenticateUserUseCase {

    /**
     * 사용자를 인증합니다.
     *
     * @param command 인증 명령 (이메일, 비밀번호)
     * @return 인증 결과 (사용자 정보)
     * @throws AuthenticationException 인증 실패 시
     */
    AuthenticateUserResult execute(AuthenticateUserCommand command);
}
