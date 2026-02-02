package me.unbrdn.core.subscription.domain.enums;

/** 할당량 단위 */
public enum QuotaUnit {
    /** 횟수 기반 */
    COUNT,

    /** 시간 기반 (분) */
    MINUTES,

    /** 용량 기반 (MB) */
    MB
}
