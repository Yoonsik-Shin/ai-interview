package me.unbrdn.core.payment.adapter.out.persistence.entity;

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
import me.unbrdn.core.payment.domain.enums.PaymentStatus;

/**
 * PG 결제 내역 엔티티
 *
 * <p>Snapshot: payment 테이블 - payment_id (PK) - user_id (FK to users) - amount: 결제 금액 - currency: 통화
 * (KRW, USD 등) - status: 결제 상태 (PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED) - pg_provider_id
 * (FK to pg_provider): PG사 정보 - pg_transaction_id: PG사 거래 ID (외부 시스템 참조용) - created_at: 결제 요청 시각 -
 * updated_at: 결제 상태 변경 시각
 *
 * <p>비즈니스 규칙: - 결제 완료(COMPLETED) 후 크레딧 지급 또는 인벤토리 추가 - 환불(REFUNDED) 시 크레딧 차감 또는 인벤토리 회수 - 모든 상태 변경은
 * 추적 가능해야 함 (updated_at)
 */
@Entity
@Table(name = "payment")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PaymentJpaEntity extends BaseTimeJpaEntity {

    @Column(name = "user_id", nullable = false)
    private java.util.UUID userId;

    @Column(nullable = false)
    private Integer amount;

    @Column(nullable = false, length = 10)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pg_provider_id")
    private PGProviderJpaEntity pgProvider;

    @Column(name = "pg_transaction_id", length = 255)
    private String pgTransactionId;
}
