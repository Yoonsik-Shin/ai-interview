package com.example.core.auth.application.service;

import lombok.Builder;
import lombok.Getter;

/**
 * 회원가입 명령 DTO
 */
@Getter
@Builder
public class RegisterUserCommand {

  private final String email;
  private final String password;
  private final String nickname;
}

