package me.unbrdn.core.user.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.reference.domain.Skills;

@Entity
// 🔥 핵심 변경점 1: 복합키 대신 유니크 제약조건으로 중복 방지
@Table(
        name = "user_skills",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"user_id", "skill_id"})})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class UserSkills extends BaseTimeEntity {

    // 🔥 핵심 변경점 2: 독립적인 대리키(PK) 사용

    // 🔥 핵심 변경점 3: 평범한 비식별 ManyToOne 관계로 변경 (@MapsId 제거)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skills skill;

    @Column(name = "proficiency_level", nullable = false)
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
