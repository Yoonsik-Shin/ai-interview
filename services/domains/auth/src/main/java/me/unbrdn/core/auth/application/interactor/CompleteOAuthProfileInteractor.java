package me.unbrdn.core.auth.application.interactor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.adapter.out.grpc.UserGrpcClient;
import me.unbrdn.core.auth.application.interactor.dto.command.CompleteOAuthProfileCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticateUserResult;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticatedUser;
import me.unbrdn.core.auth.application.port.in.CompleteOAuthProfileUseCase;
import me.unbrdn.core.auth.application.port.out.OAuthUserPort;
import me.unbrdn.core.auth.application.port.out.RefreshTokenPort;
import me.unbrdn.core.auth.domain.model.AuthUser;
import me.unbrdn.core.auth.domain.service.JwtTokenProvider;
import me.unbrdn.core.auth.domain.service.TokenProvider;
import me.unbrdn.core.user.application.exception.InvalidInputException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CompleteOAuthProfileInteractor implements CompleteOAuthProfileUseCase {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserGrpcClient userGrpcClient;
    private final OAuthUserPort oAuthUserPort;
    private final TokenProvider tokenProvider;
    private final RefreshTokenPort refreshTokenPort;

    @Override
    public AuthenticateUserResult execute(CompleteOAuthProfileCommand command) {
        // pending token 검증 및 claims 추출
        Map<String, Object> claims;
        try {
            claims = jwtTokenProvider.verifyOAuthPendingToken(command.getPendingToken());
        } catch (Exception e) {
            throw new InvalidInputException("유효하지 않거나 만료된 pending token입니다.");
        }

        String provider = (String) claims.get("provider");
        String providerUserId = (String) claims.get("providerUserId");
        String email = (String) claims.get("email");
        String name = (String) claims.get("name");
        String accessToken = (String) claims.get("accessToken");
        Long tokenExpiresAtEpoch = (Long) claims.get("tokenExpiresAt");

        // 역할에 따라 유저 생성
        String role = command.getRole();
        UUID userId;
        if ("CANDIDATE".equalsIgnoreCase(role)) {
            userId = userGrpcClient.createCandidate(
                    email,
                    command.getPassword(),
                    command.getNickname() != null ? command.getNickname() : name,
                    command.getPhoneNumber());
        } else if ("RECRUITER".equalsIgnoreCase(role)) {
            userId = userGrpcClient.createRecruiter(
                    email,
                    command.getPassword(),
                    command.getNickname() != null ? command.getNickname() : name,
                    command.getPhoneNumber(),
                    null);
        } else {
            throw new InvalidInputException("유효하지 않은 역할입니다: " + role);
        }

        // OAuth 연동 저장
        Instant tokenExpiresAt = Instant.ofEpochSecond(tokenExpiresAtEpoch);
        oAuthUserPort.saveOAuthLink(userId, provider, providerUserId, accessToken, tokenExpiresAt);

        // JWT 발급
        AuthUser user = userGrpcClient.loadById(userId)
                .orElseThrow(() -> new IllegalStateException("생성된 유저를 찾을 수 없습니다."));

        String userIdStr = user.getId().toString();
        String newAccessToken = tokenProvider.generateAccessToken(userIdStr, user.getRole());
        String newRefreshToken = tokenProvider.generateRefreshToken(userIdStr);
        refreshTokenPort.saveRefreshToken(userIdStr, newRefreshToken);

        AuthenticatedUser authenticatedUser = AuthenticatedUser.builder()
                .id(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .nickname(user.getNickname())
                .phoneNumber(user.getPhoneNumber())
                .profileImageUrl(user.getProfileImageUrl())
                .build();

        return AuthenticateUserResult.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .user(authenticatedUser)
                .build();
    }
}
