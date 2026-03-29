package me.unbrdn.core.auth.adapter.in.grpc;

import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.auth.application.interactor.dto.command.AuthenticateUserCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.CompleteOAuthProfileCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.LoginWithOAuthCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.RefreshTokenCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterCandidateCommand;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterRecruiterCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticateUserResult;
import me.unbrdn.core.auth.application.interactor.dto.result.LoginWithOAuthResult;
import me.unbrdn.core.auth.application.interactor.dto.result.RefreshTokenResult;
import me.unbrdn.core.auth.application.port.in.AuthenticateUserUseCase;
import me.unbrdn.core.auth.application.port.in.CompleteOAuthProfileUseCase;
import me.unbrdn.core.auth.application.port.in.LoginWithOAuthUseCase;
import me.unbrdn.core.auth.application.port.in.RefreshTokenUseCase;
import me.unbrdn.core.auth.application.port.in.RegisterCandidateUseCase;
import me.unbrdn.core.auth.application.port.in.RegisterRecruiterUseCase;
import me.unbrdn.core.grpc.auth.v1.AuthServiceGrpc;
import me.unbrdn.core.grpc.auth.v1.AuthenticateUserRequest;
import me.unbrdn.core.grpc.auth.v1.AuthenticateUserResponse;
import me.unbrdn.core.grpc.auth.v1.CompleteOAuthProfileRequest;
import me.unbrdn.core.grpc.auth.v1.LoginWithOAuthRequest;
import me.unbrdn.core.grpc.auth.v1.LoginWithOAuthResponse;
import me.unbrdn.core.grpc.auth.v1.RefreshTokenRequest;
import me.unbrdn.core.grpc.auth.v1.RefreshTokenResponse;
import me.unbrdn.core.grpc.auth.v1.RegisterCandidateRequest;
import me.unbrdn.core.grpc.auth.v1.RegisterRecruiterRequest;
import me.unbrdn.core.grpc.auth.v1.RegisterResponse;
import me.unbrdn.core.grpc.auth.v1.User;
import me.unbrdn.core.user.application.exception.InvalidInputException;
import net.devh.boot.grpc.server.service.GrpcService;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class AuthGrpcController extends AuthServiceGrpc.AuthServiceImplBase {

    private final RegisterCandidateUseCase registerCandidateUseCase;
    private final RegisterRecruiterUseCase registerRecruiterUseCase;
    private final AuthenticateUserUseCase authenticateUserUseCase;
    private final RefreshTokenUseCase refreshTokenUseCase;
    private final LoginWithOAuthUseCase loginWithOAuthUseCase;
    private final CompleteOAuthProfileUseCase completeOAuthProfileUseCase;

    @Override
    public void authenticateUser(
            AuthenticateUserRequest request,
            StreamObserver<AuthenticateUserResponse> responseObserver) {
        AuthenticateUserCommand command =
                AuthenticateUserCommand.builder()
                        .email(request.getEmail())
                        .password(request.getPassword())
                        .build();

        AuthenticateUserResult result = authenticateUserUseCase.execute(command);

        AuthenticateUserResponse response =
                AuthenticateUserResponse.newBuilder()
                        .setAccessToken(result.getAccessToken())
                        .setRefreshToken(result.getRefreshToken())
                        .setUser(
                                User.newBuilder()
                                        .setId(result.getUser().getId().toString())
                                        .setEmail(result.getUser().getEmail())
                                        .setNickname(result.getUser().getNickname())
                                        .setRole(result.getUser().getRole())
                                        .build())
                        .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void registerCandidate(
            RegisterCandidateRequest request, StreamObserver<RegisterResponse> responseObserver) {
        RegisterCandidateCommand command =
                RegisterCandidateCommand.builder()
                        .email(request.getEmail())
                        .password(request.getPassword())
                        .nickname(request.getNickname())
                        .phoneNumber(request.getPhoneNumber())
                        .build();

        UUID userId = registerCandidateUseCase.execute(command);

        RegisterResponse response =
                RegisterResponse.newBuilder().setUserId(userId.toString()).build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void registerRecruiter(
            RegisterRecruiterRequest request, StreamObserver<RegisterResponse> responseObserver) {
        RegisterRecruiterCommand command =
                RegisterRecruiterCommand.builder()
                        .email(request.getEmail())
                        .password(request.getPassword())
                        .nickname(request.getNickname())
                        .companyCode(request.getCompanyCode())
                        .phoneNumber(request.getPhoneNumber())
                        .build();

        UUID userId = registerRecruiterUseCase.execute(command);

        RegisterResponse response =
                RegisterResponse.newBuilder().setUserId(userId.toString()).build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void refreshToken(
            RefreshTokenRequest request, StreamObserver<RefreshTokenResponse> responseObserver) {
        RefreshTokenCommand command =
                RefreshTokenCommand.builder().refreshToken(request.getRefreshToken()).build();

        RefreshTokenResult result = refreshTokenUseCase.execute(command);

        RefreshTokenResponse response =
                RefreshTokenResponse.newBuilder()
                        .setAccessToken(result.getAccessToken())
                        .setRefreshToken(result.getRefreshToken())
                        .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void loginWithOAuth(
            LoginWithOAuthRequest request, StreamObserver<LoginWithOAuthResponse> responseObserver) {
        try {
            LoginWithOAuthCommand command =
                    LoginWithOAuthCommand.builder()
                            .provider(request.getProvider())
                            .providerUserId(request.getProviderUserId())
                            .accessToken(request.getAccessToken())
                            .tokenExpiresAt(request.getTokenExpiresAt())
                            .email(request.getEmail())
                            .name(request.getName())
                            .pictureUrl(request.getPictureUrl())
                            .build();

            LoginWithOAuthResult result = loginWithOAuthUseCase.execute(command);

            LoginWithOAuthResponse.Builder responseBuilder =
                    LoginWithOAuthResponse.newBuilder().setIsNewUser(result.isNewUser());

            if (result.isNewUser()) {
                responseBuilder.setPendingToken(result.getPendingToken());
            } else {
                AuthenticateUserResult auth = result.getAuth();
                responseBuilder.setAuth(
                        AuthenticateUserResponse.newBuilder()
                                .setAccessToken(auth.getAccessToken())
                                .setRefreshToken(auth.getRefreshToken())
                                .setUser(
                                        User.newBuilder()
                                                .setId(auth.getUser().getId().toString())
                                                .setEmail(auth.getUser().getEmail())
                                                .setNickname(auth.getUser().getNickname())
                                                .setRole(auth.getUser().getRole())
                                                .build())
                                .build());
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (InvalidInputException e) {
            responseObserver.onError(
                    Status.INVALID_ARGUMENT.withDescription(e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void completeOAuthProfile(
            CompleteOAuthProfileRequest request,
            StreamObserver<AuthenticateUserResponse> responseObserver) {
        try {
            CompleteOAuthProfileCommand command =
                    CompleteOAuthProfileCommand.builder()
                            .pendingToken(request.getPendingToken())
                            .role(request.getRole())
                            .phoneNumber(request.getPhoneNumber())
                            .nickname(request.getNickname())
                            .password(request.getPassword())
                            .build();

            AuthenticateUserResult result = completeOAuthProfileUseCase.execute(command);

            AuthenticateUserResponse response =
                    AuthenticateUserResponse.newBuilder()
                            .setAccessToken(result.getAccessToken())
                            .setRefreshToken(result.getRefreshToken())
                            .setUser(
                                    User.newBuilder()
                                            .setId(result.getUser().getId().toString())
                                            .setEmail(result.getUser().getEmail())
                                            .setNickname(result.getUser().getNickname())
                                            .setRole(result.getUser().getRole())
                                            .build())
                            .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (InvalidInputException e) {
            responseObserver.onError(
                    Status.INVALID_ARGUMENT.withDescription(e.getMessage()).asRuntimeException());
        }
    }
}
