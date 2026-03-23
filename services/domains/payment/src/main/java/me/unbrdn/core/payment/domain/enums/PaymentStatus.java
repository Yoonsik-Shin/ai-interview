package me.unbrdn.core.payment.domain.enums;

/** 결제 상태 */
public enum PaymentStatus {
    /** 결제 대기 */
    PENDING,

    /** 결제 성공 */
    SUCCESS,

    /** 결제 실패 */
    FAILED,

    /** 환불 */
    REFUNDED
}
