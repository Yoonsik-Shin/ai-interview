package com.example.core.auth.adapter.in.grpc;

import com.example.core.adapter.in.grpc.GlobalGrpcExceptionHandler;
import com.example.core.auth.application.port.in.AuthenticateUserUseCase;
import com.example.core.auth.application.port.in.RegisterUserUseCase;
import com.example.core.auth.application.service.AuthenticateUserCommand;
import com.example.core.auth.application.service.AuthenticateUserResult;
import com.example.core.auth.application.service.RegisterUserCommand;
import com.example.core.grpc.AuthProto.ValidateUserRequest;
import com.example.core.grpc.AuthProto.ValidateUserResponse;
import com.example.core.grpc.AuthProto.SignupRequest;
import com.example.core.grpc.AuthProto.SignupResponse;
import com.example.core.grpc.AuthServiceGrpc.AuthServiceImplBase;

import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Auth gRPC Controller
 * 
 * Input Adapter: gRPC 요청을 받아 Application Layer의 UseCase를 호출합니다.
 * 
 * AuthServiceImplBase: gRPC 코드 생성 시 proto 파일로부터 자동 생성되는 베이스 클래스입니다. 이 클래스를 상속하여
 * RPC 메서드를 구현합니다.
 */
@Slf4j
@GrpcService
@RequiredArgsConstructor
public class AuthGrpcController extends AuthServiceImplBase {

  private final RegisterUserUseCase registerUserUseCase;
  private final AuthenticateUserUseCase authenticateUserUseCase;

  @Override
  public void signup(SignupRequest request, StreamObserver<SignupResponse> responseObserver) {
    log.info("gRPC 요청 수신: Signup - email={}", request.getEmail());

    try {
      // 1. Command 생성
      RegisterUserCommand command = RegisterUserCommand.builder().email(request.getEmail())
          .password(request.getPassword()).nickname(request.getNickname()).build();

      // 2. UseCase 실행
      Long userId = registerUserUseCase.execute(command);

      // 3. 응답 생성 및 전송
      SignupResponse response = SignupResponse.newBuilder().setUserId(userId).build();

      responseObserver.onNext(response);
      responseObserver.onCompleted();
      log.info("gRPC 응답 전송 완료: userId={}", userId);

    } catch (Exception e) {
      io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
      responseObserver.onError(status.asRuntimeException());
    }
  }

  @Override
  public void validateUser(ValidateUserRequest request, StreamObserver<ValidateUserResponse> responseObserver) {
    log.info("gRPC 요청 수신: ValidateUser - email={}", request.getEmail());

    try {
      // 1. Command 생성
      AuthenticateUserCommand command = AuthenticateUserCommand.builder().email(request.getEmail())
          .password(request.getPassword()).build();

      // 2. UseCase 실행
      AuthenticateUserResult result = authenticateUserUseCase.execute(command);

      // 3. 응답 생성 및 전송
      ValidateUserResponse response = ValidateUserResponse.newBuilder().setUserId(result.getUserId())
          .setEmail(result.getEmail()).setNickname(result.getNickname()).setRole(result.getRole().name()).build();

      responseObserver.onNext(response);
      responseObserver.onCompleted();
      log.info("gRPC 응답 전송 완료: userId={}", result.getUserId());

    } catch (Exception e) {
      io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
      responseObserver.onError(status.asRuntimeException());
    }
  }
}
