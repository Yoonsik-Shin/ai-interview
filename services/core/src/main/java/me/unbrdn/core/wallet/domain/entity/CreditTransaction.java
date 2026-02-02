package me.unbrdn.core.wallet.domain.entity;

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
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.wallet.domain.enums.CreditReferenceType;
import me.unbrdn.core.wallet.domain.enums.TransactionType;

/** 크레딧 장부 엔티티 크레딧 증감 이력 관리 */
@Entity
@Table(name = "credit_transaction")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CreditTransaction extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

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

    private CreditTransaction(
            Wallet wallet,
            Integer amount,
            TransactionType type,
            CreditReferenceType referenceType,
            String referenceId) {
        this.wallet = wallet;
        this.amount = amount;
        this.type = type;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
    }

    /** 크레딧 증가 거래 생성 */
    public static CreditTransaction createIncrease(
            Wallet wallet, Integer amount, CreditReferenceType referenceType, String referenceId) {
        if (amount <= 0) {
            throw new IllegalArgumentException("증가량은 0보다 커야 합니다.");
        }
        return new CreditTransaction(
                wallet, amount, TransactionType.INCREASE, referenceType, referenceId);
    }

    /** 크레딧 차감 거래 생성 */
    public static CreditTransaction createDecrease(
            Wallet wallet, Integer amount, CreditReferenceType referenceType, String referenceId) {
        if (amount <= 0) {
            throw new IllegalArgumentException("차감량은 0보다 커야 합니다.");
        }
        return new CreditTransaction(
                wallet, amount, TransactionType.DECREASE, referenceType, referenceId);
    }
}
