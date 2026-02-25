package me.unbrdn.core.auth.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseJpaEntity;

@Entity
@Table(name = "oauth_provider")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OauthProviderJpaEntity extends BaseJpaEntity {

    @Column(name = "company_name", nullable = false, unique = true, length = 50)
    private String companyName;
}
