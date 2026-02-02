package me.unbrdn.core.reference.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;

/** 약관 엔티티 */
@Entity
@Table(name = "term")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Term extends BaseTimeEntity {

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "deprecated_at")
    private LocalDateTime deprecatedAt;

    private Term(String title, String content, Integer version) {
        this.title = title;
        this.content = content;
        this.version = version;
    }

    /** 새로운 약관 생성 */
    public static Term create(String title, String content, Integer version) {
        return new Term(title, content, version);
    }

    /** 약관 지원 종료 */
    public void deprecate() {
        this.deprecatedAt = LocalDateTime.now();
    }

    /** 활성 약관 여부 확인 */
    public boolean isActive() {
        return this.deprecatedAt == null;
    }
}
