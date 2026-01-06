package me.unbrdn.core.auth.application.exception;

import lombok.Getter;

/**
 * 인증 실패 예외
 */
@Getter
public class AuthenticationException extends RuntimeException {

  public AuthenticationException(String message) {
    super(message);
  }

  public AuthenticationException(String message, Throwable cause) {
    super(message, cause);
  }
}
