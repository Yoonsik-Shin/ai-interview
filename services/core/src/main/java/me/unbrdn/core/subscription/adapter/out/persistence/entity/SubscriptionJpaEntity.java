package me.unbrdn.core.subscription.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import me.unbrdn.core.user.adapter.out.persistence.entity.UserJpaEntity;

/**
 * 구독 계약서 엔티티
 *
 * <p>Snapshot: subscription 테이블 - subscription_id (PK) - user_id (FK to users): 구독자 - plan_id (FK
 * to plan): 구독 플랜 - start_date: 구독 시작일 - end_date: 구독 종료일 (null인 경우 진행 중) - is_active: 활성 여부 -
 * created_at: 계약 생성일시
 *
 * <p>비즈니스 규칙: - 사용자는 동시에 하나의 활성 구독만 가질 수 있음 - 구독 만료 시 자동으로 is_active = false 처리 - PlanQuota를 참조하여
 * 사용 가능한 리소스 확인 - 구독 종료 시 end_date 설정
 */
@Entity
@Table(name = "subscription")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SubscriptionJpaEntity extends BaseTimeJpaEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserJpaEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private PlanJpaEntity plan;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;
}
