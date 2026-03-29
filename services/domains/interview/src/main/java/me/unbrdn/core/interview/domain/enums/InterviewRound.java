package me.unbrdn.core.interview.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum InterviewRound {
    TECHNICAL("1차 기술 면접"),
    CULTURE_FIT("2차 컬처핏 면접"),
    EXECUTIVE("임원 면접");

    private final String description;
}
