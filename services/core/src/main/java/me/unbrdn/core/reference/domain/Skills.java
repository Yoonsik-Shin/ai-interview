package me.unbrdn.core.reference.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.resume.domain.enums.SkillCategory;

@Entity
@Table(name = "skills")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Skills extends BaseTimeEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private SkillCategory category;

    private Skills(String name, SkillCategory category) {
        this.name = name;
        this.category = category;
    }

    public static Skills create(String name, SkillCategory category) {
        return new Skills(name, category);
    }

    public static Skills create(String name) {
        return new Skills(name, SkillCategory.HARD);
    }
}
