package me.unbrdn.core.reference.domain;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseEntity;

/** 직무분야 엔티티 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class JobField extends BaseEntity {

    private String name;

    private JobField(String name) {
        this.name = name;
    }

    /** 새로운 직무분야 생성 */
    public static JobField create(String name) {
        return new JobField(name);
    }

    /** 직무분야명 업데이트 */
    public void updateName(String name) {
        this.name = name;
    }
}
