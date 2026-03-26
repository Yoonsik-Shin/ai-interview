package me.unbrdn.core.auth.application.interactor;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.adapter.out.grpc.UserGrpcClient;
import me.unbrdn.core.auth.application.interactor.dto.command.LoginWithOAuthCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticateUserResult;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticatedUser;
import me.unbrdn.core.auth.application.interactor.dto.result.LoginWithOAuthResult;
import me.unbrdn.core.auth.application.port.in.LoginWithOAuthUseCase;
import me.unbrdn.core.auth.application.port.out.OAuthUserPort;
import me.unbrdn.core.auth.application.port.out.RefreshTokenPort;
import me.unbrdn.core.auth.domain.model.AuthUser;
import me.unbrdn.core.auth.domain.service.JwtTokenProvider;
import me.unbrdn.core.auth.domain.service.TokenProvider;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LoginWithOAuthInteractor implements LoginWithOAuthUseCase {

    private final OAuthUserPort oAuthUserPort;
    private final UserGrpcClient userGrpcClient;
    private final TokenProvider tokenProvider;
    private final RefreshTokenPort refreshTokenPort;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public LoginWithOAuthResult execute(LoginWithOAuthCommand command) {
        Optional<UUID> existingUserId = oAuthUserPort.findUserIdByProviderAndProviderUserId(
                command.getProvider(), command.getProviderUserId());

        if (existingUserId.isPresent()) {
            // 기존 유저: JWT 발급 후 로그인
            AuthUser user = userGrpcClient.loadById(existingUserId.get())
                    .orElseThrow(() -> new IllegalStateException("OAuth 연동된 유저를 찾을 수 없습니다."));

            String userId = user.getId().toString();
            String accessToken = tokenProvider.generateAccessToken(userId, user.getRole());
            String refreshToken = tokenProvider.generateRefreshToken(userId);
            refreshTokenPort.saveRefreshToken(userId, refreshToken);

            AuthenticatedUser authenticatedUser = AuthenticatedUser.builder()
                    .id(user.getId())
                    .email(user.getEmail())
                    .role(user.getRole())
                    .nickname(user.getNickname())
                    .phoneNumber(user.getPhoneNumber())
                    .profileImageUrl(user.getProfileImageUrl())
                    .build();

            AuthenticateUserResult auth = AuthenticateUserResult.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .user(authenticatedUser)
                    .build();

            return LoginWithOAuthResult.builder()
                    .isNewUser(false)
                    .auth(auth)
                    .build();
        }

        // 신규 유저: 5분짜리 pending token 발급
        String pendingToken = jwtTokenProvider.generateOAuthPendingToken(
                command.getProvider(),
                command.getProviderUserId(),
                command.getEmail(),
                command.getName(),
                command.getPictureUrl(),
                command.getAccessToken(),
                command.getTokenExpiresAt());

        return LoginWithOAuthResult.builder()
                .isNewUser(true)
                .pendingToken(pendingToken)
                .build();
    }
}
