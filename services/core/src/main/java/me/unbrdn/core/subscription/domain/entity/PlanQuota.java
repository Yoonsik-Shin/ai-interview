package me.unbrdn.core.subscription.domain.entity;

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
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.subscription.domain.enums.QuotaUnit;

/**
 * 구독플랜별 월 제공량 엔티티
 *
 * <p>Snapshot: plan_quota 테이블 - quota_id (PK) - plan_id (FK to plan) - quota_name: 할당량 이름 (예: 면접
 * 횟수, 이력서 개수) - quota_amount: 월별 제공량 - quota_unit: 단위 (COUNT, MINUTES, etc.) - created_at: 생성일시
 *
 * <p>예시: - Free Plan: 면접 5회, 이력서 1개 - Pro Plan: 면접 무제한, 이력서 5개
 *
 * <p>비즈니스 규칙: - 각 플랜은 여러 개의 할당량 항목을 가질 수 있음 - 할당량은 매월 1일 00:00에 초기화됨 (SubscriptionUsage 참조)
 */
@Entity
@Table(name = "plan_quota")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlanQuota extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Column(name = "quota_name", nullable = false, length = 100)
    private String quotaName;

    @Column(name = "quota_amount", nullable = false)
    private Integer quotaAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "quota_unit", nullable = false, length = 20)
    private QuotaUnit quotaUnit;

    private PlanQuota(Plan plan, String quotaName, Integer quotaAmount, QuotaUnit quotaUnit) {
        this.plan = plan;
        this.quotaName = quotaName;
        this.quotaAmount = quotaAmount;
        this.quotaUnit = quotaUnit;
    }

    /** 새로운 플랜 할당량 생성 */
    public static PlanQuota create(
            Plan plan, String quotaName, Integer quotaAmount, QuotaUnit quotaUnit) {
        if (quotaAmount < 0) {
            throw new IllegalArgumentException("할당량은 0 이상이어야 합니다. (무제한은 -1로 표현)");
        }
        return new PlanQuota(plan, quotaName, quotaAmount, quotaUnit);
    }

    /** 할당량 업데이트 */
    public void updateQuota(Integer newAmount) {
        if (newAmount < 0 && newAmount != -1) {
            throw new IllegalArgumentException("할당량은 0 이상이거나 -1(무제한)이어야 합니다.");
        }
        this.quotaAmount = newAmount;
    }

    /** 무제한 여부 확인 */
    public boolean isUnlimited() {
        return this.quotaAmount == -1;
    }
}
