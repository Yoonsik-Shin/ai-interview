package me.unbrdn.core.user.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.user.domain.enums.AccountStatus;
import me.unbrdn.core.user.domain.enums.UserRole;

/** 채용담당자 엔티티 (User의 서브클래스) - Pure POJO */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recruiter extends User {

    private String nickname;
    private String companyCode;

    /** OAuth 소셜 로그인으로 가입하는 팩토리 메서드 (비밀번호는 잠금 계정용 랜덤 해시) */
    public static Recruiter createWithOAuth(
            String email,
            String nickname,
            String phoneNumber,
            String profileImageUrl,
            PasswordEncoder encoder) {
        return Recruiter.builder()
                .email(email)
                .password(encoder.encode(java.util.UUID.randomUUID().toString()))
                .nickname(nickname)
                .role(UserRole.RECRUITER)
                .phoneNumber(phoneNumber)
                .profileImageUrl(profileImageUrl)
                .isActive(AccountStatus.ACTIVE)
                .build();
    }

    /** 비밀번호 해시화까지 책임지는 팩토리 메서드 */
    public static Recruiter createWithRawPassword(
            String email,
            String rawPassword,
            String nickname,
            String companyCode,
            String phoneNumber,
            PasswordEncoder encoder) {
        String encoded = encoder.encode(rawPassword);
        return Recruiter.builder()
                .email(email)
                .password(encoded)
                .nickname(nickname)
                .companyCode(companyCode)
                .role(UserRole.RECRUITER)
                .phoneNumber(phoneNumber)
                .isActive(AccountStatus.ACTIVE)
                .build();
    }
}
