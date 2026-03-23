package me.unbrdn.core.reference.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseJpaEntity;

/** 직무분야 엔티티 */
@Entity
@Table(name = "job_field")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class JobFieldJpaEntity extends BaseJpaEntity {

    @Column(nullable = false, length = 100)
    private String name;
}
