package me.unbrdn.core.resume.application.exception;

import io.grpc.Status;
import lombok.Getter;
import me.unbrdn.core.common.infrastructure.grpc.GrpcException;

/** 이미 등록된 이력서 (해시 일치) 예외 */
@Getter
@GrpcException(Status.Code.ALREADY_EXISTS)
public class DuplicateResumeException extends RuntimeException {

    public DuplicateResumeException(String message) {
        super(message);
    }
}
