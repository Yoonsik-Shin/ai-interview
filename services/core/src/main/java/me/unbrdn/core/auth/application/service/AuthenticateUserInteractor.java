package me.unbrdn.core.auth.application.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import me.unbrdn.core.auth.application.exception.AuthenticationException;
import me.unbrdn.core.auth.application.port.in.AuthenticateUserUseCase;
import me.unbrdn.core.auth.application.port.out.LoadUserPort;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.domain.entity.Users;

import lombok.RequiredArgsConstructor;

/**
 * 사용자 인증 UseCase 구현체 (Interactor)
 * 
 * 비즈니스 로직:
 * 1. 이메일로 사용자 조회
 * 2. 비밀번호 검증
 * 3. 인증 결과 반환
 */
@Service
@RequiredArgsConstructor
public class AuthenticateUserInteractor implements AuthenticateUserUseCase {

  private final LoadUserPort loadUserPort;
  private final PasswordEncoder passwordEncoder;

  @Override
  public AuthenticateUserResult execute(AuthenticateUserCommand command) {
    // 1. 이메일로 사용자 조회
    Optional<Users> userOpt = loadUserPort.loadByEmail(command.getEmail());

    if (userOpt.isEmpty()) {
      throw new AuthenticationException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    Users user = userOpt.get();

    // 2. 비밀번호 검증
    String encodedPassword = user.getEncodedPassword();
    if (encodedPassword == null || !passwordEncoder.matches(command.getPassword(), encodedPassword)) {
      throw new AuthenticationException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    // 3. 인증 결과 반환
    return AuthenticateUserResult.builder()
        .userId(user.getUserId())
        .email(user.getEmail())
        .nickname(user.getNickname())
        .role(user.getRole())
        .build();
  }
}

