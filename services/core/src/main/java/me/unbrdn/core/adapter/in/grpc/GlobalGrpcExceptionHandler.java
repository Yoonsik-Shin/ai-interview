package me.unbrdn.core.adapter.in.grpc;

import org.springframework.stereotype.Component;

import me.unbrdn.core.auth.application.exception.AuthenticationException;
import me.unbrdn.core.auth.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.resume.application.exception.UserNotFoundException;

import lombok.extern.slf4j.Slf4j;

/**
 * gRPC 전역 예외 처리 핸들러
 * 
 * gRPC Controller에서 발생하는 예외를 gRPC Status로 변환합니다.
 */
@Slf4j
@Component
public class GlobalGrpcExceptionHandler {

  /**
   * 예외를 gRPC Status로 변환
   */
  public static io.grpc.Status toGrpcStatus(Throwable throwable) {
    log.error("gRPC 예외 발생", throwable);

    if (throwable instanceof UserAlreadyExistsException) {
      return io.grpc.Status.ALREADY_EXISTS.withDescription(throwable.getMessage());
    }

    if (throwable instanceof AuthenticationException) {
      return io.grpc.Status.UNAUTHENTICATED.withDescription(throwable.getMessage());
    }

    if (throwable instanceof UserNotFoundException) {
      return io.grpc.Status.NOT_FOUND.withDescription(throwable.getMessage());
    }

    if (throwable instanceof IllegalArgumentException) {
      return io.grpc.Status.INVALID_ARGUMENT.withDescription(throwable.getMessage());
    }

    // 기본적으로 INTERNAL로 처리
    return io.grpc.Status.INTERNAL.withDescription("서버 내부 오류가 발생했습니다: " + throwable.getMessage());
  }
}
