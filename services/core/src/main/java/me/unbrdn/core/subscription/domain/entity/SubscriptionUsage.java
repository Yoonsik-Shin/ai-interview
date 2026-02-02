package me.unbrdn.core.subscription.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseEntity;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * 구독 할당량 사용량 엔티티
 *
 * <p>Snapshot: subscription_usages 테이블 - usage_id (PK) - subscription_id (FK to subscription) -
 * quota_name: 사용한 할당량 이름 (plan_quota.quota_name과 동일) - used_amount: 사용량 - usage_month: 사용 월
 * (YYYY-MM 형식) - updated_at: 마지막 갱신 시각
 *
 * <p>비즈니스 규칙: - 매월 1일 00:00에 모든 사용량 초기화 - PlanQuota에 정의된 할당량을 초과하면 사용 불가 - 사용량은 누적되며, 차감은 불가 (환불 시
 * 별도 처리)
 *
 * <p>예시: - subscription_id=1, quota_name="interview_count", used_amount=3, usage_month="2026-01" -
 * subscription_id=1, quota_name="resume_count", used_amount=1, usage_month="2026-01"
 */
@Entity
@Table(name = "subscription_usages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class SubscriptionUsage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subscription_id", nullable = false)
    private Subscription subscription;

    @Column(name = "quota_name", nullable = false, length = 100)
    private String quotaName;

    @Column(name = "used_amount", nullable = false)
    private Integer usedAmount;

    @Column(name = "usage_month", nullable = false, length = 7)
    private String usageMonth;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private SubscriptionUsage(Subscription subscription, String quotaName, String usageMonth) {
        this.subscription = subscription;
        this.quotaName = quotaName;
        this.usedAmount = 0;
        this.usageMonth = usageMonth;
    }

    /** 새로운 구독 사용량 생성 (초기값 0) */
    public static SubscriptionUsage create(
            Subscription subscription, String quotaName, String usageMonth) {
        return new SubscriptionUsage(subscription, quotaName, usageMonth);
    }

    /** 사용량 증가 */
    public void incrementUsage(Integer amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("증가량은 0보다 커야 합니다.");
        }
        this.usedAmount += amount;
    }

    /** 사용량 초기화 (월별 리셋) */
    public void reset() {
        this.usedAmount = 0;
    }

    /** 특정 할당량을 초과했는지 확인 */
    public boolean exceedsQuota(Integer quotaLimit) {
        if (quotaLimit == -1) {
            return false; // 무제한
        }
        return this.usedAmount >= quotaLimit;
    }
}
