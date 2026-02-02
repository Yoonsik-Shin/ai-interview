package me.unbrdn.core.auth.application.exception;

import io.grpc.Status;
import lombok.Getter;
import me.unbrdn.core.common.infrastructure.grpc.GrpcException;

/** 인증 실패 예외 */
@Getter
@GrpcException(Status.Code.UNAUTHENTICATED)
public class AuthenticationException extends RuntimeException {

    public AuthenticationException(String message) {
        super(message);
    }

    public AuthenticationException(String message, Throwable cause) {
        super(message, cause);
    }
}
