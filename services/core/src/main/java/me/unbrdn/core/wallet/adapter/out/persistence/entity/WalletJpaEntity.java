package me.unbrdn.core.wallet.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserJpaEntity;

/** 크레딧 관리 지갑 엔티티 */
@Entity
@Table(name = "wallet")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WalletJpaEntity extends BaseJpaEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private UserJpaEntity user;

    @Column(name = "free_credits", nullable = false)
    private Integer freeCredits;

    @Column(name = "paid_credits", nullable = false)
    private Integer paidCredits;
}
