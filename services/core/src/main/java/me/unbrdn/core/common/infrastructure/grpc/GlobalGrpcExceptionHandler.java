package me.unbrdn.core.common.infrastructure.grpc;

import io.grpc.Status;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * gRPC 전역 예외 처리 핸들러
 *
 * <p>gRPC Controller에서 발생하는 예외를 gRPC Status로 변환합니다. @GrpcException 어노테이션이 붙은 예외는 자동으로 매핑되며, 그 외 예외는
 * INTERNAL로 처리됩니다.
 */
@Slf4j
@Component
public class GlobalGrpcExceptionHandler {

    /**
     * 예외를 gRPC Status로 변환
     *
     * <p>예외 클래스에 @GrpcException 어노테이션이 있으면 해당 Status를 사용하고, 없으면 INTERNAL로 처리합니다.
     *
     * @param throwable 변환할 예외
     * @return gRPC Status
     */
    public static Status toGrpcStatus(Throwable throwable) {
        log.error("gRPC 예외 발생", throwable);

        // @GrpcException 어노테이션 확인
        GrpcException annotation = throwable.getClass().getAnnotation(GrpcException.class);
        if (annotation != null) {
            return Status.fromCode(annotation.value()).withDescription(throwable.getMessage());
        }

        if (throwable instanceof IllegalArgumentException) {
            return Status.INVALID_ARGUMENT.withDescription(throwable.getMessage());
        }

        if (throwable instanceof io.grpc.StatusRuntimeException) {
            return ((io.grpc.StatusRuntimeException) throwable).getStatus();
        }

        if (throwable instanceof io.grpc.StatusException) {
            return ((io.grpc.StatusException) throwable).getStatus();
        }

        // 기본적으로 INTERNAL로 처리
        return Status.INTERNAL.withDescription("서버 내부 오류가 발생했습니다: " + throwable.getMessage());
    }
}
