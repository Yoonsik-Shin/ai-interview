package me.unbrdn.core.user.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.reference.domain.Skills;

// 🔥 핵심 변경점 1: 복합키 대신 유니크 제약조건으로 중복 방지
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class UserSkills extends BaseTimeEntity {

    // 🔥 핵심 변경점 2: 독립적인 대리키(PK) 사용

    // 🔥 핵심 변경점 3: 평범한 비식별 ManyToOne 관계로 변경 (@MapsId 제거)
    private User user;

    private Skills skill;

    private Integer proficiencyLevel;

    // 생성자 (편의상 추가)
    private UserSkills(User user, Skills skill, Integer proficiencyLevel) {
        this.user = user;
        this.skill = skill;
        this.proficiencyLevel = proficiencyLevel;
    }

    public static UserSkills create(User user, Skills skill, Integer proficiencyLevel) {
        return new UserSkills(user, skill, proficiencyLevel);
    }
}
