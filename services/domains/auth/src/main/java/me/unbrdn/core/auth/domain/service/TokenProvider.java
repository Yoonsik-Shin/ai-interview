package me.unbrdn.core.auth.domain.service;

public interface TokenProvider {
    String generateAccessToken(String userId, String role);

    String generateRefreshToken(String userId);

    String getUserIdFromRefreshToken(String refreshToken);
}
