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
import me.unbrdn.core.payment.adapter.out.persistence.entity.ProductJpaEntity;
import me.unbrdn.core.wallet.domain.enums.ProductUsageReferenceType;
import me.unbrdn.core.wallet.domain.enums.ProductUsageSourceType;

/** 상품 사용 이력 엔티티 */
@Entity
@Table(name = "product_usage_history")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProductUsageHistoryJpaEntity extends BaseTimeJpaEntity {

    @Column(name = "user_id", nullable = false)
    private java.util.UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductJpaEntity product;

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
}
