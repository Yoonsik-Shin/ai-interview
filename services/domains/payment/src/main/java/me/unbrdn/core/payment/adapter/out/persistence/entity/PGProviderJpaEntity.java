package me.unbrdn.core.payment.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;

/**
 * PG사 엔티티
 *
 * <p>Snapshot: pg_provider 테이블 - provider_id (PK) - name: PG사 이름 (예: 토스페이먼츠, 카카오페이, NHN KCP 등) -
 * created_at: 등록일시
 *
 * <p>목적: - 여러 PG사를 지원할 수 있도록 확장 가능한 구조 - Payment 테이블에서 참조하여 결제 수단별 집계 가능
 */
@Entity
@Table(name = "pg_provider")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PGProviderJpaEntity extends BaseTimeJpaEntity {

    @Column(nullable = false, unique = true, length = 100)
    private String name;
}
