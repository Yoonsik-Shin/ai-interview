package me.unbrdn.core.admin.domain.entity;

import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.admin.domain.enums.AdminRole;
import me.unbrdn.core.common.domain.BaseTimeEntity;

/**
 * 관리자 계정 엔티티 (별도 관리) User 테이블과 분리된 독립적인 관리자 계정
 *
 * <p>Snapshot: admin 테이블 - admin_id (PK) - username: 관리자 계정명 - password: BCrypt 해시 비밀번호 - role: 관리자
 * 권한 (SUPER_ADMIN, ADMIN, OPERATOR) - email: 이메일 - phone_number: 전화번호 - is_active: 활성화 여부 -
 * last_login_at: 마지막 로그인 시각 - last_login_ip: 마지막 로그인 IP - created_at: 생성일시 - updated_at: 수정일시
 *
 * <p>보안 규칙: - User 테이블과 완전히 분리하여 권한 혼선 방지 - 2FA(Two-Factor Authentication) 필수 - 모든 활동은 AdminAudit
 * 로그에 기록
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Admin extends BaseTimeEntity {

    private String username;

    private String password;

    private AdminRole role;

    private String email;

    private String phoneNumber;

    private Boolean isActive;

    private LocalDateTime lastLoginAt;

    private String lastLoginIp;

    private Admin(
            String username, String password, AdminRole role, String email, String phoneNumber) {
        this.username = username;
        this.password = password;
        this.role = role;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.isActive = true;
    }

    /** 새로운 관리자 계정 생성 */
    public static Admin create(
            String username,
            String encodedPassword,
            AdminRole role,
            String email,
            String phoneNumber) {
        return new Admin(username, encodedPassword, role, email, phoneNumber);
    }

    /** 로그인 정보 갱신 */
    public void updateLoginInfo(String ipAddress) {
        this.lastLoginAt = LocalDateTime.now();
        this.lastLoginIp = ipAddress;
    }

    /** 계정 활성화/비활성화 */
    public void setActive(boolean isActive) {
        this.isActive = isActive;
    }

    /** 비밀번호 변경 */
    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }
}
