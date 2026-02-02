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
import me.unbrdn.core.payment.domain.entity.Product;
import me.unbrdn.core.user.domain.entity.User;
import me.unbrdn.core.wallet.domain.enums.ProductUsageReferenceType;
import me.unbrdn.core.wallet.domain.enums.ProductUsageSourceType;

/** 상품 사용 이력 엔티티 */
@Entity
@Table(name = "product_usage_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProductUsageHistory extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private ProductUsageSourceType sourceType;

    @Column(nullable = false)
    private Integer amount;

    @Column(name = "reference_id", nullable = false, length = 255)
    private String referenceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reference_type", nullable = false, length = 50)
    private ProductUsageReferenceType referenceType;

    private ProductUsageHistory(
            User user,
            Product product,
            ProductUsageSourceType sourceType,
            Integer amount,
            String referenceId,
            ProductUsageReferenceType referenceType) {
        this.user = user;
        this.product = product;
        this.sourceType = sourceType;
        this.amount = amount;
        this.referenceId = referenceId;
        this.referenceType = referenceType;
    }

    /** 새로운 상품 사용 이력 생성 */
    public static ProductUsageHistory create(
            User user,
            Product product,
            ProductUsageSourceType sourceType,
            Integer amount,
            String referenceId,
            ProductUsageReferenceType referenceType) {
        if (amount <= 0) {
            throw new IllegalArgumentException("사용량은 0보다 커야 합니다.");
        }
        return new ProductUsageHistory(
                user, product, sourceType, amount, referenceId, referenceType);
    }
}
