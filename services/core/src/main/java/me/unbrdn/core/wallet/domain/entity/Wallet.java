package me.unbrdn.core.wallet.domain.entity;

import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseEntity;
import me.unbrdn.core.user.domain.entity.User;

/** 크레딧 관리 지갑 엔티티 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Wallet extends BaseEntity {

    private User user;

    private Integer freeCredits;

    private Integer paidCredits;

    private LocalDateTime updatedAt;

    private Wallet(User user, Integer freeCredits, Integer paidCredits) {
        this.user = user;
        this.freeCredits = freeCredits;
        this.paidCredits = paidCredits;
    }

    /** 새로운 지갑 생성 (기본 무료 크레딧 2000) */
    public static Wallet create(User user) {
        return new Wallet(user, 2000, 0);
    }

    /** 무료 크레딧 추가 */
    public void addFreeCredits(Integer amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("추가할 크레딧은 0보다 커야 합니다.");
        }
        this.freeCredits += amount;
    }

    /** 유료 크레딧 추가 */
    public void addPaidCredits(Integer amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("추가할 크레딧은 0보다 커야 합니다.");
        }
        this.paidCredits += amount;
    }

    /** 크레딧 차감 (무료 크레딧 우선 사용) */
    public void deductCredits(Integer amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("차감할 크레딧은 0보다 커야 합니다.");
        }

        int totalCredits = this.freeCredits + this.paidCredits;
        if (totalCredits < amount) {
            throw new IllegalStateException("크레딧이 부족합니다.");
        }

        // 무료 크레딧 먼저 차감
        if (this.freeCredits >= amount) {
            this.freeCredits -= amount;
        } else {
            int remaining = amount - this.freeCredits;
            this.freeCredits = 0;
            this.paidCredits -= remaining;
        }
    }

    /** 전체 크레딧 조회 */
    public Integer getTotalCredits() {
        return this.freeCredits + this.paidCredits;
    }

    /** 크레딧 충분 여부 확인 */
    public boolean hasEnoughCredits(Integer amount) {
        return getTotalCredits() >= amount;
    }
}
