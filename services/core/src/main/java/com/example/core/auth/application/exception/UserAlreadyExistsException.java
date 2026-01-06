package com.example.core.auth.application.exception;

import lombok.Getter;

/**
 * 사용자 이미 존재 예외
 */
@Getter
public class UserAlreadyExistsException extends RuntimeException {

  public UserAlreadyExistsException(String message) {
    super(message);
  }
}
