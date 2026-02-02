package me.unbrdn.core.auth.application.exception;

import io.grpc.Status;
import lombok.Getter;
import me.unbrdn.core.common.infrastructure.grpc.GrpcException;

/** 사용자 이미 존재 예외 */
@Getter
@GrpcException(Status.Code.ALREADY_EXISTS)
public class UserAlreadyExistsException extends RuntimeException {

    public UserAlreadyExistsException(String message) {
        super(message);
    }
}
