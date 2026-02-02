package me.unbrdn.core.auth.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseEntity;

// TODO: OAuthProvider 관련 기능 구현 필요
/** 소셜로그인 지원 플랫폼 엔티티 */
@Entity
@Table(name = "oauth_provider")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OauthProvider extends BaseEntity {

    @Column(name = "company_name", nullable = false, unique = true, length = 50)
    private String companyName;

    private OauthProvider(String companyName) {
        this.companyName = companyName;
    }

    public static OauthProvider create(String companyName) {
        return new OauthProvider(companyName);
    }
}
