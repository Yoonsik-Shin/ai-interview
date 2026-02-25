package me.unbrdn.core.wallet.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.payment.adapter.out.persistence.entity.ProductJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserJpaEntity;
import me.unbrdn.core.wallet.domain.enums.InventoryStatus;

/** 유저 구매 상품 인벤토리 엔티티 */
@Entity
@Table(name = "inventory")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InventoryJpaEntity extends BaseTimeJpaEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserJpaEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductJpaEntity product;

    @Column(name = "total_count", nullable = false)
    private Integer totalCount;

    @Column(name = "remaining_count", nullable = false)
    private Integer remainingCount;

    @Column(name = "expired_at", nullable = false)
    private LocalDateTime expiredAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InventoryStatus status;
}
