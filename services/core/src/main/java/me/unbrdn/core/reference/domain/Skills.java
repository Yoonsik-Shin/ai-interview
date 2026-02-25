package me.unbrdn.core.reference.domain;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.resume.domain.enums.SkillCategory;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Skills extends BaseTimeEntity {

    private String name;

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
