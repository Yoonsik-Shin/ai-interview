package me.unbrdn.core.payment.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseEntity;

/** 패키지 구성품 엔티티 */
@Entity
@Table(name = "package_content")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PackageContent extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_id", nullable = false)
    private Package packageEntity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
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
