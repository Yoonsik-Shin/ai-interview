package me.unbrdn.core.payment.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseEntity;

/** 패키지 구성품 엔티티 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PackageContent extends BaseEntity {

    private Package packageEntity;

    private Product product;

    private Integer quantity;

    private PackageContent(Package packageEntity, Product product, Integer quantity) {
        this.packageEntity = packageEntity;
        this.product = product;
        this.quantity = quantity;
    }

    /** 새로운 패키지 구성품 생성 */
    public static PackageContent create(Package packageEntity, Product product, Integer quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("수량은 0보다 커야 합니다.");
        }
        return new PackageContent(packageEntity, product, quantity);
    }

    /** 수량 업데이트 */
    public void updateQuantity(Integer quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("수량은 0보다 커야 합니다.");
        }
        this.quantity = quantity;
    }
}
