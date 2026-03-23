package me.unbrdn.core.auth.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.adapter.out.grpc.UserGrpcClient;
import me.unbrdn.core.auth.application.exception.AuthenticationException;
import me.unbrdn.core.auth.application.interactor.dto.command.RefreshTokenCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.RefreshTokenResult;
import me.unbrdn.core.auth.application.port.in.RefreshTokenUseCase;
import me.unbrdn.core.auth.application.port.out.RefreshTokenPort;
import me.unbrdn.core.auth.domain.model.AuthUser;
import me.unbrdn.core.auth.domain.service.TokenProvider;
import org.springframework.stereotype.Service;

/** 리프레시 토큰으로 액세스/리프레시 토큰 재발급 */
@Service
@RequiredArgsConstructor
public class RefreshTokenInteractor implements RefreshTokenUseCase {
    private final UserGrpcClient userGrpcClient;
    private final TokenProvider tokenProvider;
    private final RefreshTokenPort refreshTokenPort;

    @Override
    public RefreshTokenResult execute(RefreshTokenCommand command) {
        String userId = parseUserId(command.getRefreshToken());

        String storedToken =
                refreshTokenPort
                        .loadRefreshToken(userId)
                        .orElseThrow(() -> new AuthenticationException("Invalid refresh token."));
        if (!storedToken.equals(command.getRefreshToken())) {
            throw new AuthenticationException("Invalid refresh token.");
        }

        AuthUser user = loadUser(userId);

        String accessToken = tokenProvider.generateAccessToken(userId, user.getRole());
        String refreshToken = tokenProvider.generateRefreshToken(userId);
        refreshTokenPort.saveRefreshToken(userId, refreshToken);

        return RefreshTokenResult.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }

    private String parseUserId(String refreshToken) {
        try {
            return tokenProvider.getUserIdFromRefreshToken(refreshToken);
        } catch (RuntimeException ex) {
            throw new AuthenticationException("Invalid refresh token.", ex);
        }
    }

    private AuthUser loadUser(String userId) {
        try {
            return userGrpcClient
                    .loadById(UUID.fromString(userId))
                    .orElseThrow(() -> new AuthenticationException("User not found."));
        } catch (IllegalArgumentException ex) {
            throw new AuthenticationException("Invalid refresh token.", ex);
        }
    }
}
