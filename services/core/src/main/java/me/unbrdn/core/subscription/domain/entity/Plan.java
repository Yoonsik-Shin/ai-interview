package me.unbrdn.core.subscription.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;

/**
 * 구독 플랜 엔티티
 *
 * <p>Snapshot: plan 테이블 - plan_id (PK) - name: 플랜 이름 (예: Free, Basic, Pro, Enterprise) - price: 월
 * 구독료 (KRW 기준) - description: 플랜 설명 - created_at: 생성일시
 *
 * <p>관련 엔티티: - PlanQuota: 플랜별 월 제공량 (면접 횟수, 이력서 개수 등) - Subscription: 사용자의 구독 계약 -
 * SubscriptionUsage: 구독 플랜의 사용량 추적
 *
 * <p>비즈니스 규칙: - 플랜은 삭제하지 않고 deprecated_at으로 관리 (과거 구독 이력 보존) - 각 플랜은 여러 개의 PlanQuota를 가질 수 있음
 */
@Entity
@Table(name = "plan")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Plan extends BaseTimeEntity {

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false)
    private Integer price;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "deprecated_at")
    private LocalDateTime deprecatedAt;

    private Plan(String name, Integer price, String description) {
        this.name = name;
        this.price = price;
        this.description = description;
    }

    /** 새로운 구독 플랜 생성 */
    public static Plan create(String name, Integer price, String description) {
        return new Plan(name, price, description);
    }

    /** 플랜 정보 업데이트 */
    public void update(String name, Integer price, String description) {
        this.name = name;
        this.price = price;
        this.description = description;
    }

    /** 플랜 판매 중지 */
    public void deprecate() {
        this.deprecatedAt = LocalDateTime.now();
    }

    /** 판매 가능 여부 확인 */
    public boolean isAvailable() {
        return this.deprecatedAt == null;
    }
}
