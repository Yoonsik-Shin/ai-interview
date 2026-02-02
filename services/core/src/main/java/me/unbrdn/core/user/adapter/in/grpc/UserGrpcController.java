package me.unbrdn.core.user.adapter.in.grpc;

import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.UserProto.Candidate;
import me.unbrdn.core.grpc.UserProto.FindUserByEmailRequest;
import me.unbrdn.core.grpc.UserProto.FindUserByEmailResponse;
import me.unbrdn.core.grpc.UserProto.FindUserByIdRequest;
import me.unbrdn.core.grpc.UserProto.FindUserByIdResponse;
import me.unbrdn.core.grpc.UserProto.Recruiter;
import me.unbrdn.core.grpc.UserProto.RegisterCandidateRequest;
import me.unbrdn.core.grpc.UserProto.RegisterRecruiterRequest;
import me.unbrdn.core.grpc.UserProto.RegisterUserResponse;
import me.unbrdn.core.grpc.UserServiceGrpc;
import me.unbrdn.core.user.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.user.application.interactor.dto.command.FindUserByEmailCommand;
import me.unbrdn.core.user.application.interactor.dto.command.FindUserByIdCommand;
import me.unbrdn.core.user.application.interactor.dto.command.RegisterCandidateCommand;
import me.unbrdn.core.user.application.interactor.dto.command.RegisterRecruiterCommand;
import me.unbrdn.core.user.application.interactor.dto.result.FindUserByEmailResult;
import me.unbrdn.core.user.application.interactor.dto.result.FindUserByIdResult;
import me.unbrdn.core.user.application.interactor.dto.result.RegisterCandidateResult;
import me.unbrdn.core.user.application.interactor.dto.result.RegisterRecruiterResult;
import me.unbrdn.core.user.application.port.in.FindUserByEmailUseCase;
import me.unbrdn.core.user.application.port.in.FindUserByIdUseCase;
import me.unbrdn.core.user.application.port.in.RegisterCandidateUseCase;
import me.unbrdn.core.user.application.port.in.RegisterRecruiterUseCase;
import me.unbrdn.core.user.domain.entity.User;
import net.devh.boot.grpc.server.service.GrpcService;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class UserGrpcController extends UserServiceGrpc.UserServiceImplBase {

    private final FindUserByEmailUseCase findUserByEmailUseCase;
    private final FindUserByIdUseCase findUserByIdUseCase;
    private final RegisterCandidateUseCase registerCandidateUseCase;
    private final RegisterRecruiterUseCase registerRecruiterUseCase;

    @Override
    public void findUserByEmail(
            FindUserByEmailRequest request,
            StreamObserver<FindUserByEmailResponse> responseObserver) {
        FindUserByEmailResult result =
                findUserByEmailUseCase.execute(
                        FindUserByEmailCommand.builder().email(request.getEmail()).build());
        FindUserByEmailResponse response =
                java.util.Optional.ofNullable(result.getUser())
                        .map(this::buildGetUserByEmailResponse)
                        .orElse(FindUserByEmailResponse.newBuilder().build());

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void findUserById(
            FindUserByIdRequest request, StreamObserver<FindUserByIdResponse> responseObserver) {
        UUID userId = parseUserId(request.getUserId(), responseObserver);
        if (userId == null) {
            return;
        }

        FindUserByIdResult result =
                findUserByIdUseCase.execute(FindUserByIdCommand.builder().userId(userId).build());
        FindUserByIdResponse response =
                java.util.Optional.ofNullable(result.getUser())
                        .map(this::buildGetUserByIdResponse)
                        .orElse(FindUserByIdResponse.newBuilder().build());

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void registerCandidate(
            RegisterCandidateRequest request,
            StreamObserver<RegisterUserResponse> responseObserver) {
        try {
            RegisterCandidateResult result =
                    registerCandidateUseCase.execute(
                            RegisterCandidateCommand.builder()
                                    .email(request.getEmail())
                                    .password(request.getPassword())
                                    .nickname(request.getNickname())
                                    .phoneNumber(request.getPhoneNumber())
                                    .build());
            RegisterUserResponse response =
                    RegisterUserResponse.newBuilder()
                            .setUserId(result.getUserId().toString())
                            .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (UserAlreadyExistsException ex) {
            responseObserver.onError(
                    Status.ALREADY_EXISTS.withDescription(ex.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void registerRecruiter(
            RegisterRecruiterRequest request,
            StreamObserver<RegisterUserResponse> responseObserver) {
        try {
            RegisterRecruiterResult result =
                    registerRecruiterUseCase.execute(
                            RegisterRecruiterCommand.builder()
                                    .email(request.getEmail())
                                    .password(request.getPassword())
                                    .nickname(request.getNickname())
                                    .phoneNumber(request.getPhoneNumber())
                                    .companyCode(request.getCompanyCode())
                                    .build());
            RegisterUserResponse response =
                    RegisterUserResponse.newBuilder()
                            .setUserId(result.getUserId().toString())
                            .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (UserAlreadyExistsException ex) {
            responseObserver.onError(
                    Status.ALREADY_EXISTS.withDescription(ex.getMessage()).asRuntimeException());
        }
    }

    private UUID parseUserId(String userId, StreamObserver<?> responseObserver) {
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException ex) {
            responseObserver.onError(
                    Status.INVALID_ARGUMENT
                            .withDescription("Invalid user_id")
                            .asRuntimeException());
            return null;
        }
    }

    private FindUserByEmailResponse buildGetUserByEmailResponse(User user) {
        FindUserByEmailResponse.Builder response = FindUserByEmailResponse.newBuilder();
        if (user instanceof me.unbrdn.core.user.domain.entity.Candidate candidate) {
            return response.setCandidate(buildCandidate(candidate)).build();
        }
        if (user instanceof me.unbrdn.core.user.domain.entity.Recruiter recruiter) {
            return response.setRecruiter(buildRecruiter(recruiter)).build();
        }
        return response.build();
    }

    private FindUserByIdResponse buildGetUserByIdResponse(User user) {
        FindUserByIdResponse.Builder response = FindUserByIdResponse.newBuilder();
        if (user instanceof me.unbrdn.core.user.domain.entity.Candidate candidate) {
            return response.setCandidate(buildCandidate(candidate)).build();
        }
        if (user instanceof me.unbrdn.core.user.domain.entity.Recruiter recruiter) {
            return response.setRecruiter(buildRecruiter(recruiter)).build();
        }
        return response.build();
    }

    private Candidate buildCandidate(me.unbrdn.core.user.domain.entity.Candidate user) {
        return Candidate.newBuilder()
                .setId(user.getId().toString())
                .setEmail(safeString(user.getEmail()))
                .setNickname(safeString(user.getNickname()))
                .setRole(user.getRole().name())
                .setPhoneNumber(safeString(user.getPhoneNumber()))
                .setVerifiedEmail(safeString(user.getVerifiedEmail()))
                .setPasswordHash(safeString(user.getPassword()))
                .build();
    }

    private Recruiter buildRecruiter(me.unbrdn.core.user.domain.entity.Recruiter user) {
        return Recruiter.newBuilder()
                .setId(user.getId().toString())
                .setEmail(safeString(user.getEmail()))
                .setNickname(safeString(user.getNickname()))
                .setRole(user.getRole().name())
                .setPhoneNumber(safeString(user.getPhoneNumber()))
                .setVerifiedEmail(safeString(user.getVerifiedEmail()))
                .setCompanyCode(safeString(user.getCompanyCode()))
                .setPasswordHash(safeString(user.getPassword()))
                .build();
    }

    private String safeString(String value) {
        return value == null ? "" : value;
    }
}
