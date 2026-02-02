package me.unbrdn.core.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** 생성자/수정자 추적 엔티티 */
@MappedSuperclass
@Getter
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseAuditEntity extends BaseTimeEntity {

    @CreatedBy
    @Column(updatable = false) // 생성자는 수정되면 안 됨
    private String createdBy;

    @LastModifiedBy private String lastModifiedBy;
}
