package me.unbrdn.core.auth.application.service;

import lombok.Builder;
import lombok.Getter;

import me.unbrdn.core.domain.enums.UserRole;

/**
 * 사용자 인증 결과 DTO
 */
@Getter
@Builder
public class AuthenticateUserResult {

  private final Long userId;
  private final String email;
  private final String nickname;
  private final UserRole role;
}

