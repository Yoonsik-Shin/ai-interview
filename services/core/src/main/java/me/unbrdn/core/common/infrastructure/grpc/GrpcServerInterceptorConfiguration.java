package me.unbrdn.core.common.infrastructure.grpc;

import lombok.RequiredArgsConstructor;
import net.devh.boot.grpc.server.interceptor.GlobalServerInterceptorConfigurer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * gRPC 서버 Interceptor 설정
 *
 * <p>GrpcExceptionInterceptor를 gRPC 서버에 등록합니다. net.devh.boot.grpc.server의
 * GlobalServerInterceptorConfigurer를 사용하여 자동으로 모든 gRPC 서비스에 Interceptor가 적용됩니다.
 */
@Configuration
@RequiredArgsConstructor
public class GrpcServerInterceptorConfiguration {

    private final GrpcExceptionInterceptor grpcExceptionInterceptor;

    /**
     * GlobalServerInterceptorConfigurer 빈 생성
     *
     * <p>Spring Boot for gRPC에서 제공하는 GlobalServerInterceptorConfigurer를 구현하여
     * GrpcExceptionInterceptor를 등록합니다.
     *
     * @return GlobalServerInterceptorConfigurer 구현체
     */
    @Bean
    public GlobalServerInterceptorConfigurer grpcServerInterceptorConfigurer() {
        return registry -> registry.add(grpcExceptionInterceptor);
    }
}
