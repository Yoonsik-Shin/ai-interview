package me.unbrdn.core.user.domain.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.user.domain.enums.AccountStatus;
import me.unbrdn.core.user.domain.enums.UserRole;

/** 채용담당자 엔티티 (User의 서브클래스) */
@Entity
@DiscriminatorValue("RECRUITER")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recruiter extends User {

    private String nickname;
    private String companyCode;

    @Builder(builderMethodName = "recruiterBuilder", access = AccessLevel.PRIVATE)
    private Recruiter(
            String email,
            String password,
            String nickname,
            String companyCode,
            String phoneNumber) {
        super(email, password, nickname, UserRole.RECRUITER, phoneNumber, AccountStatus.ACTIVE);
        this.nickname = nickname;
        this.companyCode = companyCode;
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
        return Recruiter.recruiterBuilder()
                .email(email)
                .password(encoded)
                .nickname(nickname)
                .companyCode(companyCode)
                .phoneNumber(phoneNumber)
                .build();
    }
}
