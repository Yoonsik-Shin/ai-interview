package me.unbrdn.core.user.domain.entity;

import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.user.domain.enums.AccountStatus;
import me.unbrdn.core.user.domain.enums.UserRole;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    private String email;

    private String password;

    private String nickname;

    private UserRole role;

    private AccountStatus isActive;

    private String phoneNumber;

    private String verifiedEmail;

    private String profileImageUrl;

    private Instant deletedAt;

    private Instant lastLoginedAt;

    /** 비밀번호 변경 */
    public void changePassword(String rawPassword, PasswordEncoder passwordEncoder) {
        this.password = passwordEncoder.encode(rawPassword);
    }

    /** 이메일 인증 완료 */
    public void verifyEmail() {
        this.verifiedEmail = this.email;
    }

    /** 프로필 이미지 업데이트 */
    public void updateProfileImage(String imageUrl) {
        this.profileImageUrl = imageUrl;
    }

    /** 로그인 시간 업데이트 */
    public void updateLastLoginTime() {
        this.lastLoginedAt = Instant.now();
    }

    /** 계정 비활성화 */
    public void deactivate() {
        this.isActive = AccountStatus.DORMANT;
    }

    /** 계정 활성화 */
    public void activate() {
        this.isActive = AccountStatus.ACTIVE;
    }

    /** 계정 삭제 (소프트 삭제) */
    public void delete() {
        this.deletedAt = Instant.now();
        this.isActive = AccountStatus.DORMANT;
    }

    /** 활성 계정 여부 확인 */
    public boolean isActive() {
        return this.isActive == AccountStatus.ACTIVE && this.deletedAt == null;
    }

    /** 비밀번호 검증 */
    public boolean isPasswordValid(String rawPassword, PasswordEncoder encoder) {
        return this.password != null && encoder.matches(rawPassword, this.password);
    }
}
