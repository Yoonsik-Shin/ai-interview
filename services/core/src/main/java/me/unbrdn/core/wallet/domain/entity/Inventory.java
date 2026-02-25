package me.unbrdn.core.wallet.domain.entity;

import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.payment.domain.entity.Product;
import me.unbrdn.core.user.domain.entity.User;
import me.unbrdn.core.wallet.domain.enums.InventoryStatus;

/** 유저 구매 상품 인벤토리 엔티티 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Inventory extends BaseTimeEntity {

    private User user;

    private Product product;

    private Integer totalCount;

    private Integer remainingCount;

    private LocalDateTime expiredAt;

    private InventoryStatus status;

    private Inventory(User user, Product product, Integer totalCount, LocalDateTime expiredAt) {
        this.user = user;
        this.product = product;
        this.totalCount = totalCount;
        this.remainingCount = totalCount;
        this.expiredAt = expiredAt;
        this.status = InventoryStatus.ACTIVE;
    }

    /** 새로운 인벤토리 생성 */
    public static Inventory create(
            User user, Product product, Integer totalCount, LocalDateTime expiredAt) {
        if (totalCount <= 0) {
            throw new IllegalArgumentException("총 지급 수량은 0보다 커야 합니다.");
        }
        return new Inventory(user, product, totalCount, expiredAt);
    }

    /** 상품 사용 (수량 차감) */
    public void use(Integer amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("사용량은 0보다 커야 합니다.");
        }

        if (this.status != InventoryStatus.ACTIVE) {
            throw new IllegalStateException("활성 상태가 아닌 인벤토리는 사용할 수 없습니다.");
        }

        if (this.remainingCount < amount) {
            throw new IllegalStateException("잔여 수량이 부족합니다.");
        }

        this.remainingCount -= amount;

        if (this.remainingCount == 0) {
            this.status = InventoryStatus.EXHAUSTED;
        }
    }

    /** 만료 처리 */
    public void expire() {
        this.status = InventoryStatus.EXPIRED;
    }

    /** 만료 여부 확인 */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(this.expiredAt);
    }

    /** 사용 가능 여부 확인 */
    public boolean isAvailable() {
        return this.status == InventoryStatus.ACTIVE && !isExpired() && this.remainingCount > 0;
    }
}
