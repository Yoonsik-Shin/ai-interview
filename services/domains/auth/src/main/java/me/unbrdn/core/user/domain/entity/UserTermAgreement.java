package me.unbrdn.core.user.domain.entity;

import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.reference.domain.Term;

/**
 * 약관동의여부 엔티티
 *
 * <p>복합키 클래스 UserTermAgreementId를 사용함
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserTermAgreement {

    private UserTermAgreementId id;

    private User user;

    private Term term;

    private Boolean isAgreed;

    private LocalDateTime agreedAt;

    private String ipAddress;

    private UserTermAgreement(User user, Term term, Boolean isAgreed, String ipAddress) {
        this.id = new UserTermAgreementId(user.getId(), term.getId());
        this.user = user;
        this.term = term;
        this.isAgreed = isAgreed;
        this.ipAddress = ipAddress;
    }

    /** 새로운 약관동의 생성 */
    public static UserTermAgreement create(
            User user, Term term, Boolean isAgreed, String ipAddress) {
        return new UserTermAgreement(user, term, isAgreed, ipAddress);
    }

    /** 약관 동의 */
    public void agree() {
        this.isAgreed = true;
    }

    /** 약관 거부 */
    public void disagree() {
        this.isAgreed = false;
    }

    /** 복합키 클래스 */
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class UserTermAgreementId implements Serializable {
        private java.util.UUID userId;
        private java.util.UUID termId;
    }
}
