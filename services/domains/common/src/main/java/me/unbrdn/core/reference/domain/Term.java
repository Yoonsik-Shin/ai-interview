package me.unbrdn.core.reference.domain;

import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;

/** 약관 엔티티 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Term extends BaseTimeEntity {

    private String title;

    private String content;

    private Integer version;

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
