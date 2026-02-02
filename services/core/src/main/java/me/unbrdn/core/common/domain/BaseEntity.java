package me.unbrdn.core.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import java.util.UUID;
import me.unbrdn.core.common.infrastructure.id.UuidHolder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 모든 엔티티의 기본 클래스
 *
 * <p>특징: UUIDv7 기반 ID를 제공 MSA 환경: 분산 서비스 간 ID 충돌 없음 시간순 정렬: 최신 데이터 조회 성능 우수 DB 호환성: PostgreSQL
 * (uuid), Oracle (RAW(16)) 지원
 */
@MappedSuperclass
public abstract class BaseEntity {

    /** UUIDv7 기반 고유 식별자 (시간순 정렬 가능) */
    @Id
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    protected UUID id;

    // ID가 null일 경우에만 UUIDv7을 생성
    @PrePersist
    protected void generateId() {
        if (this.id == null) {
            this.id = UuidHolder.generate();
        }
    }

    // Getter & Setter

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    // equals & hashCode (ID 기반)

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BaseEntity that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
