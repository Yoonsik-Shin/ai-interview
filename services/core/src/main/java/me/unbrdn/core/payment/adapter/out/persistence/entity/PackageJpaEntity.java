package me.unbrdn.core.payment.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseJpaEntity;

/** 단품 패키지 상품 엔티티 */
@Entity
@Table(name = "package")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PackageJpaEntity extends BaseJpaEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private Integer price;

    @Column(length = 1000)
    private String description;
}
