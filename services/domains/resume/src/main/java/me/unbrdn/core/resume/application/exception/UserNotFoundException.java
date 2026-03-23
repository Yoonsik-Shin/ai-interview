package me.unbrdn.core.resume.application.exception;

import io.grpc.Status;
import lombok.Getter;
import me.unbrdn.core.common.infrastructure.grpc.GrpcException;

/** 사용자 없음 예외 */
@Getter
@GrpcException(Status.Code.NOT_FOUND)
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(String message) {
        super(message);
    }
}
