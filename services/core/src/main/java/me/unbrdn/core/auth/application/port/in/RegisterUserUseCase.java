package me.unbrdn.core.auth.application.port.in;

import me.unbrdn.core.auth.application.service.RegisterUserCommand;

/**
 * 회원가입 UseCase 인터페이스
 * 
 * Input Port: Application Layer에서 외부(Adapter)로 노출하는 인터페이스
 */
public interface RegisterUserUseCase {

  /**
   * 사용자를 등록합니다.
   * 
   * @param command 회원가입 명령
   * @return 생성된 사용자 ID
   */
  Long execute(RegisterUserCommand command);
}

