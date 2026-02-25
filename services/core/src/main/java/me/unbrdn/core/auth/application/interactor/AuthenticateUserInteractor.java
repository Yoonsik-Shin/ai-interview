package me.unbrdn.core.auth.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.adapter.out.grpc.UserGrpcClient;
import me.unbrdn.core.auth.application.exception.AuthenticationException;
import me.unbrdn.core.auth.application.interactor.dto.command.AuthenticateUserCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticateUserResult;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticatedUser;
import me.unbrdn.core.auth.application.port.in.AuthenticateUserUseCase;
import me.unbrdn.core.auth.application.port.out.RefreshTokenPort;
import me.unbrdn.core.auth.domain.model.AuthUser;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.auth.domain.service.TokenProvider;
import org.springframework.stereotype.Service;

/**
 * 사용자 인증
 *
 * <p>비즈니스 로직: 1. 이메일로 사용자 조회 2. 비밀번호 검증 3. 인증 결과 반환
 */
@Service
@RequiredArgsConstructor
public class AuthenticateUserInteractor implements AuthenticateUserUseCase {
    private final UserGrpcClient userGrpcClient;
    private final PasswordEncoder passwordEncoder;
    private final TokenProvider tokenProvider;
    private final RefreshTokenPort refreshTokenPort;

    @Override
    public AuthenticateUserResult execute(AuthenticateUserCommand command) {
        AuthUser user =
                userGrpcClient
                        .loadByEmail(command.getEmail())
                        .orElseThrow(() -> new AuthenticationException("이메일 또는 비밀번호가 올바르지 않습니다."));

        if (!passwordEncoder.matches(command.getPassword(), user.getPasswordHash())) {
            throw new AuthenticationException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        String userId = user.getId().toString();
        String accessToken = tokenProvider.generateAccessToken(userId, user.getRole());
        String refreshToken = tokenProvider.generateRefreshToken(userId);

        refreshTokenPort.saveRefreshToken(userId, refreshToken);

        AuthenticatedUser authenticatedUser =
                AuthenticatedUser.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .role(user.getRole())
                        .nickname(user.getNickname())
                        .phoneNumber(user.getPhoneNumber())
                        .profileImageUrl(user.getProfileImageUrl())
                        .build();

        return AuthenticateUserResult.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(authenticatedUser)
                .build();
    }
}
