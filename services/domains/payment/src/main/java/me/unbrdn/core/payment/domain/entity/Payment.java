package me.unbrdn.core.payment.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
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
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payment extends BaseTimeEntity {

    private java.util.UUID userId;

    private Integer amount;

    private String currency;

    private PaymentStatus status;

    private PGProvider pgProvider;

    private String pgTransactionId;

    private Payment(
            java.util.UUID userId,
            Integer amount,
            String currency,
            PGProvider pgProvider,
            String pgTransactionId) {
        this.userId = userId;
        this.amount = amount;
        this.currency = currency;
        this.status = PaymentStatus.PENDING;
        this.pgProvider = pgProvider;
        this.pgTransactionId = pgTransactionId;
    }

    /** 새로운 결제 내역 생성 (초기 상태: PENDING) */
    public static Payment create(
            java.util.UUID userId,
            Integer amount,
            String currency,
            PGProvider pgProvider,
            String pgTransactionId) {
        return new Payment(userId, amount, currency, pgProvider, pgTransactionId);
    }

    /** 결제 완료 처리 */
    public void complete() {
        if (this.status != PaymentStatus.PENDING) {
            throw new IllegalStateException("Only PENDING payments can be completed");
        }
        this.status = PaymentStatus.SUCCESS;
    }

    /** 결제 실패 처리 */
    public void fail() {
        if (this.status != PaymentStatus.PENDING) {
            throw new IllegalStateException("Only PENDING payments can be failed");
        }
        this.status = PaymentStatus.FAILED;
    }

    /** 결제 취소 처리 */
    public void cancel() {
        if (this.status != PaymentStatus.PENDING) {
            throw new IllegalStateException("Only PENDING payments can be cancelled");
        }
        this.status = PaymentStatus.REFUNDED;
    }

    /** 환불 처리 */
    public void refund() {
        if (this.status != PaymentStatus.SUCCESS) {
            throw new IllegalStateException("Only SUCCESS payments can be refunded");
        }
        this.status = PaymentStatus.REFUNDED;
    }

    /** 결제 완료 여부 확인 */
    public boolean isCompleted() {
        return this.status == PaymentStatus.SUCCESS;
    }
}
