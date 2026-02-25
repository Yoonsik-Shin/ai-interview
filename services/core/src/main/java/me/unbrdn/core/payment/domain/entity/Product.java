package me.unbrdn.core.payment.domain.entity;

import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.payment.domain.enums.ProductType;

/** 상품 엔티티 Product Aggregate의 Root Entity */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Product extends BaseTimeEntity {

    private String name;

    private ProductType type;

    private Integer price;

    private String currency;

    private String description;

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
