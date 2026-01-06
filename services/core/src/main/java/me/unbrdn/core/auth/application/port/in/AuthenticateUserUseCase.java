package me.unbrdn.core.auth.application.port.in;

import me.unbrdn.core.auth.application.service.AuthenticateUserCommand;
import me.unbrdn.core.auth.application.service.AuthenticateUserResult;

/**
 * 사용자 인증 UseCase 인터페이스
 * 
 * Input Port: Application Layer에서 외부(Adapter)로 노출하는 인터페이스
 */
public interface AuthenticateUserUseCase {

  /**
   * 사용자를 인증합니다.
   * 
   * @param command 인증 명령 (이메일, 비밀번호)
   * @return 인증 결과 (사용자 정보)
   * @throws me.unbrdn.core.auth.application.exception.AuthenticationException 인증 실패 시
   */
  AuthenticateUserResult execute(AuthenticateUserCommand command);
}

