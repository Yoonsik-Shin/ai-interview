package me.unbrdn.core.wallet.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.wallet.domain.enums.CreditReferenceType;
import me.unbrdn.core.wallet.domain.enums.TransactionType;

/** 크레딧 장부 엔티티 크레딧 증감 이력 관리 */
@Entity
@Table(name = "credit_transaction")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CreditTransactionJpaEntity extends BaseTimeJpaEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private WalletJpaEntity wallet;

    @Column(nullable = false)
    private Integer amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "reference_type", nullable = false, length = 50)
    private CreditReferenceType referenceType;

    @Column(name = "reference_id", length = 255)
    private String referenceId;
}
