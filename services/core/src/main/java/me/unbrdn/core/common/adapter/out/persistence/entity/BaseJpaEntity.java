package me.unbrdn.core.common.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import java.io.Serializable;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.infrastructure.id.UuidHolder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@MappedSuperclass
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public abstract class BaseJpaEntity implements Serializable {

    @Id
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    protected UUID id;

    @PrePersist
    protected void generateId() {
        if (this.id == null) {
            this.id = UuidHolder.generate();
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BaseJpaEntity that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
