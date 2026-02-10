package me.unbrdn.core.interview.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum InterviewPersonality {
    PRESSURE("압박", "PRESSURE", "날카로운 분위기"),
    COMFORTABLE("편안", "COMFORTABLE", "격려하는 분위기"),
    RANDOM("랜덤", "RANDOM", "무작위 분위기");

    private final String name;
    private final String code;
    private final String description;
}
