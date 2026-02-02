package me.unbrdn.core.user.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.reference.domain.Term;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * 약관동의여부 엔티티
 *
 * <p>복합키(@EmbeddedId)를 사용하므로 BaseEntity를 상속받지 않음
 */
@Entity
@Table(name = "user_term_agreement")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class UserTermAgreement {

    @EmbeddedId private UserTermAgreementId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @MapsId("termId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "term_id", nullable = false)
    private Term term;

    @Column(name = "is_agreed", nullable = false)
    private Boolean isAgreed;

    @Column(name = "agreed_at", nullable = false, updatable = false)
    private LocalDateTime agreedAt;

    @Column(name = "ip_address", length = 50)
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
    @Embeddable
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class UserTermAgreementId implements Serializable {
        @Column(name = "user_id", columnDefinition = "uuid")
        private java.util.UUID userId;

        @Column(name = "term_id", columnDefinition = "uuid")
        private java.util.UUID termId;
    }
}
