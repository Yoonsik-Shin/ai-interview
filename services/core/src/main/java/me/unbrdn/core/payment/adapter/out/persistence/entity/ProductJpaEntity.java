package me.unbrdn.core.payment.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.payment.domain.enums.ProductType;

/** 상품 엔티티 Product Aggregate의 Root Entity */
@Entity
@Table(name = "product")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProductJpaEntity extends BaseTimeJpaEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductType type;

    @Column(nullable = false)
    private Integer price;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(length = 1000)
    private String description;

    @Column(name = "deprecated_at")
    private LocalDateTime deprecatedAt;
}
