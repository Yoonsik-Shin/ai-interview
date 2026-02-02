package me.unbrdn.core.payment.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.payment.domain.enums.ProductType;

/** 상품 엔티티 Product Aggregate의 Root Entity */
@Entity
@Table(name = "product")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Product extends BaseTimeEntity {

    @Column(nullable = false, length = 255)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductType type;

    @Column(nullable = false)
    private Integer price;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "deprecated_at")
    private LocalDateTime deprecatedAt;

    private Product(
            String name, ProductType type, Integer price, String currency, String description) {
        this.name = name;
        this.type = type;
        this.price = price;
        this.currency = currency;
        this.description = description;
    }

    /** 새로운 상품 생성 */
    public static Product create(
            String name, ProductType type, Integer price, String currency, String description) {
        return new Product(name, type, price, currency, description);
    }

    /** 상품 정보 업데이트 */
    public void update(String name, Integer price, String description) {
        this.name = name;
        this.price = price;
        this.description = description;
    }

    /** 상품 판매 중지 */
    public void deprecate() {
        this.deprecatedAt = LocalDateTime.now();
    }

    /** 판매 가능 여부 확인 */
    public boolean isAvailable() {
        return this.deprecatedAt == null;
    }
}
