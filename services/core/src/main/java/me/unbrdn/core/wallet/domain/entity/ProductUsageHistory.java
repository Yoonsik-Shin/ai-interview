package me.unbrdn.core.wallet.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.payment.domain.entity.Product;
import me.unbrdn.core.user.domain.entity.User;
import me.unbrdn.core.wallet.domain.enums.ProductUsageReferenceType;
import me.unbrdn.core.wallet.domain.enums.ProductUsageSourceType;

/** 상품 사용 이력 엔티티 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProductUsageHistory extends BaseTimeEntity {

    private User user;

    private Product product;

    private ProductUsageSourceType sourceType;

    private Integer amount;

    private String referenceId;

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
