package me.unbrdn.core.common.infrastructure.grpc;

import io.grpc.Status;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * gRPC 예외 매핑 어노테이션
 *
 * <p>이 어노테이션이 붙은 예외는 자동으로 gRPC Status로 변환됩니다.
 *
 * <p>사용 예: @GrpcException(value = Status.Code.ALREADY_EXISTS) public class
 * UserAlreadyExistsException extends RuntimeException { }
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface GrpcException {
    Status.Code value();
}
