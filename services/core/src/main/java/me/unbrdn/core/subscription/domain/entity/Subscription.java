package me.unbrdn.core.subscription.domain.entity;

import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.user.domain.entity.User;

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
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Subscription extends BaseTimeEntity {

    private User user;

    private Plan plan;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    private Boolean isActive;

    private Subscription(User user, Plan plan, LocalDateTime startDate) {
        this.user = user;
        this.plan = plan;
        this.startDate = startDate;
        this.isActive = true;
    }

    /** 새로운 구독 생성 */
    public static Subscription create(User user, Plan plan, LocalDateTime startDate) {
        return new Subscription(user, plan, startDate);
    }

    /** 구독 종료 */
    public void cancel() {
        if (!this.isActive) {
            throw new IllegalStateException("이미 종료된 구독입니다.");
        }
        this.endDate = LocalDateTime.now();
        this.isActive = false;
    }

    /** 구독 만료 여부 확인 */
    public boolean isExpired() {
        return this.endDate != null && this.endDate.isBefore(LocalDateTime.now());
    }

    /** 플랜 변경 */
    public void changePlan(Plan newPlan) {
        if (!this.isActive) {
            throw new IllegalStateException("비활성 구독은 플랜을 변경할 수 없습니다.");
        }
        this.plan = newPlan;
    }
}
