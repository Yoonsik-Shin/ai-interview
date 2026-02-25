package me.unbrdn.core.reference.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;

/** 약관 엔티티 */
@Entity
@Table(name = "term")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TermJpaEntity extends BaseTimeJpaEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "deprecated_at")
    private LocalDateTime deprecatedAt;
}
