package me.unbrdn.core.resume.application.exception;

import lombok.Getter;

/**
 * 사용자 없음 예외
 */
@Getter
public class UserNotFoundException extends RuntimeException {

  public UserNotFoundException(String message) {
    super(message);
  }
}
