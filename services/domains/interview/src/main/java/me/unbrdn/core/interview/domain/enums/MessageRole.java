package me.unbrdn.core.interview.domain.enums;

public enum MessageRole {
    SYSTEM, // 면접 진행 안내 멘트 (필요 시)
    AI, // 면접관 (LLM)
    USER // 지원자
}
