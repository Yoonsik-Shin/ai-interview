package me.unbrdn.core.user.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorColumn;
import jakarta.persistence.DiscriminatorType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.user.domain.enums.AccountStatus;
import me.unbrdn.core.user.domain.enums.UserRole;

@Entity
@Table(name = "users")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "role", discriminatorType = DiscriminatorType.STRING)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password", nullable = false, length = 255)
    private String password;

    @Column(name = "nickname", nullable = false, length = 50, unique = true)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, insertable = false, updatable = false)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "is_active", nullable = false, length = 20)
    private AccountStatus isActive;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "verified_email", length = 255)
    private String verifiedEmail;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "last_logined_at")
    private Instant lastLoginedAt;

    @Builder(access = AccessLevel.PROTECTED)
    /** 서브클래스에서 호출할 수 있는 protected 생성자 */
    protected User(
            String email,
            String password,
            String nickname,
            UserRole role,
            String phoneNumber,
            AccountStatus isActive) {
        this.email = email;
        this.password = password;
        this.nickname = nickname;
        this.role = role;
        this.phoneNumber = phoneNumber;
        this.isActive = isActive;
    }

    /** 비밀번호 변경 */
    public void changePassword(String rawPassword, PasswordEncoder passwordEncoder) {
        // TODO: 비지니스 로직 추가 필요

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
    public boolean isPasswordValid(
            String rawPassword, me.unbrdn.core.auth.domain.service.PasswordEncoder encoder) {
        return this.password != null && encoder.matches(rawPassword, this.password);
    }
}
