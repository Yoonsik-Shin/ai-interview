package me.unbrdn.core.user.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Entity
@DiscriminatorValue("RECRUITER")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecruiterJpaEntity extends UserJpaEntity {

    @Column(name = "nickname", insertable = false, updatable = false)
    private String nickname;

    @Column(name = "company_code", length = 50)
    private String companyCode;
}
