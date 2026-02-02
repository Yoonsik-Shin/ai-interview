package me.unbrdn.core.common.infrastructure.grpc;

import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import java.util.Optional;
import java.util.function.Supplier;
import lombok.experimental.UtilityClass;

@UtilityClass
public class GrpcClientUtils {

    /**
     * gRPC 호출을 안전하게 수행하고, 결과가 없거나(NOT_FOUND, INVALID_ARGUMENT) 에러 발생 시 Optional로 처리합니다.
     *
     * @param grpcCall gRPC 호출 람다
     * @param <T> 응답 타입
     * @return 성공 시 Optional.of(응답), 대상이 없을 시 Optional.empty()
     * @throws StatusRuntimeException 그 외 gRPC 에러 발생 시
     */
    public static <T> Optional<T> callToOptional(Supplier<T> grpcCall) {
        try {
            return Optional.ofNullable(grpcCall.get());
        } catch (StatusRuntimeException e) {
            // 사용자를 찾지 못했을 때의 처리를 위해 NOT_FOUND와 INVALID_ARGUMENT를 무시하고 Empty 반환
            // (서버 구현에 따라 '없음'을 INVALID_ARGUMENT로 주는 경우가 있어 포함)
            if (e.getStatus().getCode() == Status.Code.NOT_FOUND
                    || e.getStatus().getCode() == Status.Code.INVALID_ARGUMENT) {
                return Optional.empty();
            }
            throw e;
        }
    }
}
