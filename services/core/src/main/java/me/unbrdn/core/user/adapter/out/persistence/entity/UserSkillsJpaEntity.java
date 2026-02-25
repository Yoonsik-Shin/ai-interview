package me.unbrdn.core.user.adapter.out.persistence.entity;

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
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.reference.adapter.out.persistence.entity.SkillsJpaEntity;

@Entity
@Table(
        name = "user_skills",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"user_id", "skill_id"})})
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserSkillsJpaEntity extends BaseTimeJpaEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserJpaEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill_id", nullable = false)
    private SkillsJpaEntity skill;

    @Column(name = "proficiency_level", nullable = false)
    private Integer proficiencyLevel;
}
