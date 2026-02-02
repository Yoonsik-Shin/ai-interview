package me.unbrdn.core.wallet.domain.enums;

/** 크레딧 증감 근거 */
public enum CreditReferenceType {
    /** 결제 */
    PAYMENT,

    /** 상품 사용 */
    PRODUCT_USAGE,

    /** 환불 */
    REFUND,

    /** 관리자 조정 */
    ADMIN_ADJUSTMENT
}
