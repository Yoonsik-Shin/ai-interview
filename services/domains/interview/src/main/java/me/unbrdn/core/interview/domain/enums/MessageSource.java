package me.unbrdn.core.interview.domain.enums;

import lombok.Getter;

@Getter
public enum MessageSource {
    LLM("AI 모델 생성"),
    SYSTEM("시스템 고정 안내");

    private final String description;

    MessageSource(String description) {
        this.description = description;
    }
}
