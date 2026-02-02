package me.unbrdn.core.common.infrastructure.grpc;

import io.grpc.ForwardingServerCall.SimpleForwardingServerCall;
import io.grpc.ForwardingServerCallListener;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * gRPC 전역 예외 처리 Interceptor
 *
 * <p>모든 gRPC 서비스 호출을 가로채서 예외를 처리합니다. 예외가 발생하면 GlobalGrpcExceptionHandler를 통해 gRPC Status로 변환하여
 * 클라이언트에 전달합니다.
 *
 * <p>이 Interceptor를 사용하면 각 gRPC Controller에서 try-catch 블록을 작성할 필요가 없습니다.
 */
@Slf4j
@Component
public class GrpcExceptionInterceptor implements ServerInterceptor {

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {

        // 예외를 처리하는 Wrapper ServerCall
        ServerCall<ReqT, RespT> wrappedCall =
                new SimpleForwardingServerCall<ReqT, RespT>(call) {
                    @Override
                    public void close(Status status, Metadata trailers) {
                        // 에러 상태인 경우 로깅
                        if (!status.isOk()) {
                            log.warn(
                                    "gRPC 에러 상태: code={}, description={}",
                                    status.getCode(),
                                    status.getDescription());
                        }
                        super.close(status, trailers);
                    }
                };

        try {
            ServerCall.Listener<ReqT> listener = next.startCall(wrappedCall, headers);
            return new ForwardingServerCallListener.SimpleForwardingServerCallListener<ReqT>(
                    listener) {
                @Override
                public void onHalfClose() {
                    try {
                        super.onHalfClose();
                    } catch (Exception e) {
                        closeCallWithException(wrappedCall, e);
                    }
                }

                @Override
                public void onMessage(ReqT message) {
                    try {
                        super.onMessage(message);
                    } catch (Exception e) {
                        closeCallWithException(wrappedCall, e);
                    }
                }

                @Override
                public void onReady() {
                    try {
                        super.onReady();
                    } catch (Exception e) {
                        closeCallWithException(wrappedCall, e);
                    }
                }
            };
        } catch (Exception e) {
            closeCallWithException(wrappedCall, e);
            // 빈 Listener 반환 (클라이언트는 close로 전달된 에러를 받음)
            return new ServerCall.Listener<ReqT>() {};
        }
    }

    private void closeCallWithException(ServerCall<?, ?> call, Exception e) {
        // 예외 발생 시 gRPC Status로 변환
        Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
        try {
            call.close(status, new Metadata());
        } catch (Exception ex) {
            // 이미 close된 경우 등 예외 무시
            log.warn("gRPC close 중 예외 발생 (무시됨)", ex);
        }
    }
}
