package me.unbrdn.core.interview.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum InterviewRole {
    TECH("기술 면접관", "TECH", "기술 역량 검증"),
    HR("인사 면접관", "HR", "조직 적합성 확인"),
    LEADER("리드 면접관", "LEADER", "리더십 및 종합 및 경험 평가"),
    EXEC("임원 면접관", "EXEC", "경영진 시각의 전략 및 인성 검증");

    private final String name;
    private final String code;
    private final String description;
}
