package me.unbrdn.core.auth.adapter.in.grpc;

import io.grpc.stub.StreamObserver;
import java.util.UUID;
import net.devh.boot.grpc.server.service.GrpcService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import me.unbrdn.core.auth.application.interactor.dto.command.AuthenticateUserCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.RefreshTokenCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterCandidateCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterRecruiterCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticateUserResult;
import me.unbrdn.core.auth.application.interactor.dto.result.RefreshTokenResult;
import me.unbrdn.core.auth.application.port.in.AuthenticateUserUseCase;
import me.unbrdn.core.auth.application.port.in.RefreshTokenUseCase;
import me.unbrdn.core.auth.application.port.in.RegisterCandidateUseCase;
import me.unbrdn.core.auth.application.port.in.RegisterRecruiterUseCase;
import me.unbrdn.core.grpc.auth.v1.AuthenticateUserRequest;
import me.unbrdn.core.grpc.auth.v1.AuthenticateUserResponse;
import me.unbrdn.core.grpc.auth.v1.RefreshTokenRequest;
import me.unbrdn.core.grpc.auth.v1.RefreshTokenResponse;
import me.unbrdn.core.grpc.auth.v1.RegisterCandidateRequest;
import me.unbrdn.core.grpc.auth.v1.RegisterRecruiterRequest;
import me.unbrdn.core.grpc.auth.v1.RegisterResponse;
import me.unbrdn.core.grpc.auth.v1.AuthServiceGrpc;
import me.unbrdn.core.grpc.auth.v1.User;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class AuthGrpcController extends AuthServiceGrpc.AuthServiceImplBase {

    private final RegisterCandidateUseCase registerCandidateUseCase;
    private final RegisterRecruiterUseCase registerRecruiterUseCase;
    private final AuthenticateUserUseCase authenticateUserUseCase;
    private final RefreshTokenUseCase refreshTokenUseCase;

    @Override
    public void authenticateUser(AuthenticateUserRequest request,
            StreamObserver<AuthenticateUserResponse> responseObserver) {
        AuthenticateUserCommand command = AuthenticateUserCommand.builder().email(request.getEmail())
                .password(request.getPassword()).build();

        AuthenticateUserResult result = authenticateUserUseCase.execute(command);

        AuthenticateUserResponse response = AuthenticateUserResponse.newBuilder()
                .setAccessToken(result.getAccessToken()).setRefreshToken(result.getRefreshToken())
                .setUser(User.newBuilder().setId(result.getUser().getId().toString())
                        .setEmail(result.getUser().getEmail()).setNickname(result.getUser().getNickname())
                        .setRole(result.getUser().getRole()).build())
                .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void registerCandidate(RegisterCandidateRequest request, StreamObserver<RegisterResponse> responseObserver) {
        RegisterCandidateCommand command = RegisterCandidateCommand.builder().email(request.getEmail())
                .password(request.getPassword()).nickname(request.getNickname()).phoneNumber(request.getPhoneNumber())
                .build();

        UUID userId = registerCandidateUseCase.execute(command);

        RegisterResponse response = RegisterResponse.newBuilder().setUserId(userId.toString()).build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void registerRecruiter(RegisterRecruiterRequest request, StreamObserver<RegisterResponse> responseObserver) {
        RegisterRecruiterCommand command = RegisterRecruiterCommand.builder().email(request.getEmail())
                .password(request.getPassword()).nickname(request.getNickname()).companyCode(request.getCompanyCode())
                .phoneNumber(request.getPhoneNumber()).build();

        UUID userId = registerRecruiterUseCase.execute(command);

        RegisterResponse response = RegisterResponse.newBuilder().setUserId(userId.toString()).build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void refreshToken(RefreshTokenRequest request, StreamObserver<RefreshTokenResponse> responseObserver) {
        RefreshTokenCommand command = RefreshTokenCommand.builder().refreshToken(request.getRefreshToken()).build();

        RefreshTokenResult result = refreshTokenUseCase.execute(command);

        RefreshTokenResponse response = RefreshTokenResponse.newBuilder().setAccessToken(result.getAccessToken())
                .setRefreshToken(result.getRefreshToken()).build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
