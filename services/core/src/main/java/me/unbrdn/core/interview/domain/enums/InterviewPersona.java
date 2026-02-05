package me.unbrdn.core.interview.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum InterviewPersona {
    MAIN("진행 면접관", "MAIN", "정중하지만 단호함"),
    TECH("기술 면접관", "TECH", "날카롭고 분석적임"),
    HR("인성 면접관", "HR", "따뜻하고 공감적임"),
    EXEC("임원 면접관", "EXEC", "통찰력 있고 진중함");

    private final String name;
    private final String role;
    private final String tone;
}
