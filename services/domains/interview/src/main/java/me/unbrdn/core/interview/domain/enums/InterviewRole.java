package me.unbrdn.core.interview.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum InterviewRole {
    TECH("기술 면접관", "TECH", "기술 역량 검증"),
    HR("인사 면접관", "HR", "조직 적합성 확인"),
    LEADER("리드 면접관", "LEADER", "리더십 및 종합 평가");

    private final String name;
    private final String code;
    private final String description;
}
