package me.unbrdn.core.common.domain;

/** 생성자/수정자 추적 엔티티 */
public abstract class BaseAuditEntity extends BaseTimeEntity {

    private String createdBy;

    private String lastModifiedBy;
}
