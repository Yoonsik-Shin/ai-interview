package me.unbrdn.core.auth.adapter.out.grpc;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.domain.model.AuthUser;
import me.unbrdn.core.common.infrastructure.grpc.GrpcClientUtils;
import me.unbrdn.core.grpc.user.v1.Candidate;
import me.unbrdn.core.grpc.user.v1.FindUserByEmailRequest;
import me.unbrdn.core.grpc.user.v1.FindUserByEmailResponse;
import me.unbrdn.core.grpc.user.v1.FindUserByIdRequest;
import me.unbrdn.core.grpc.user.v1.FindUserByIdResponse;
import me.unbrdn.core.grpc.user.v1.Recruiter;
import me.unbrdn.core.grpc.user.v1.RegisterCandidateRequest;
import me.unbrdn.core.grpc.user.v1.RegisterRecruiterRequest;
import me.unbrdn.core.grpc.user.v1.RegisterUserResponse;
import me.unbrdn.core.grpc.user.v1.UserServiceGrpc;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserGrpcClient {

    @GrpcClient("user-service")
    private UserServiceGrpc.UserServiceBlockingStub userStub;

    public Optional<AuthUser> loadByEmail(String email) {
        return GrpcClientUtils.callToOptional(
                        () ->
                                userStub.findUserByEmail(
                                        FindUserByEmailRequest.newBuilder()
                                                .setEmail(email)
                                                .build()))
                .flatMap(
                        response ->
                                mapAuthUser(
                                        response.getUserCase(),
                                        response.getCandidate(),
                                        response.getRecruiter()));
    }

    public Optional<AuthUser> loadById(UUID userId) {
        return GrpcClientUtils.callToOptional(
                        () ->
                                userStub.findUserById(
                                        FindUserByIdRequest.newBuilder()
                                                .setUserId(userId.toString())
                                                .build()))
                .flatMap(
                        response ->
                                mapAuthUser(
                                        response.getUserCase(),
                                        response.getCandidate(),
                                        response.getRecruiter()));
    }

    public UUID createCandidate(
            String email, String password, String nickname, String phoneNumber) {
        RegisterCandidateRequest request =
                RegisterCandidateRequest.newBuilder()
                        .setEmail(email)
                        .setPassword(password)
                        .setNickname(nickname == null ? "" : nickname)
                        .setPhoneNumber(phoneNumber == null ? "" : phoneNumber)
                        .build();
        RegisterUserResponse response = userStub.registerCandidate(request);
        return UUID.fromString(response.getUserId());
    }

    public UUID createRecruiter(
            String email,
            String password,
            String nickname,
            String phoneNumber,
            String companyCode) {
        RegisterRecruiterRequest request =
                RegisterRecruiterRequest.newBuilder()
                        .setEmail(email)
                        .setPassword(password)
                        .setNickname(nickname == null ? "" : nickname)
                        .setPhoneNumber(phoneNumber == null ? "" : phoneNumber)
                        .setCompanyCode(companyCode == null ? "" : companyCode)
                        .build();
        RegisterUserResponse response = userStub.registerRecruiter(request);
        return UUID.fromString(response.getUserId());
    }

    private Optional<AuthUser> mapAuthUser(
            FindUserByEmailResponse.UserCase userCase, Candidate candidate, Recruiter recruiter) {
        if (userCase == FindUserByEmailResponse.UserCase.CANDIDATE) {
            return Optional.of(fromCandidate(candidate));
        }
        if (userCase == FindUserByEmailResponse.UserCase.RECRUITER) {
            return Optional.of(fromRecruiter(recruiter));
        }
        return Optional.empty();
    }

    private Optional<AuthUser> mapAuthUser(
            FindUserByIdResponse.UserCase userCase, Candidate candidate, Recruiter recruiter) {
        if (userCase == FindUserByIdResponse.UserCase.CANDIDATE) {
            return Optional.of(fromCandidate(candidate));
        }
        if (userCase == FindUserByIdResponse.UserCase.RECRUITER) {
            return Optional.of(fromRecruiter(recruiter));
        }
        return Optional.empty();
    }

    private AuthUser fromCandidate(Candidate candidate) {
        return AuthUser.builder()
                .id(UUID.fromString(candidate.getId()))
                .email(candidate.getEmail())
                .passwordHash(candidate.getPasswordHash())
                .nickname(candidate.getNickname())
                .role(candidate.getRole())
                .phoneNumber(candidate.getPhoneNumber())
                .build();
    }

    private AuthUser fromRecruiter(Recruiter recruiter) {
        return AuthUser.builder()
                .id(UUID.fromString(recruiter.getId()))
                .email(recruiter.getEmail())
                .passwordHash(recruiter.getPasswordHash())
                .nickname(recruiter.getNickname())
                .role(recruiter.getRole())
                .phoneNumber(recruiter.getPhoneNumber())
                .build();
    }
}
