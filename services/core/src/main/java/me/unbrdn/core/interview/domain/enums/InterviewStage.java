package me.unbrdn.core.interview.domain.enums;

/**
 * 면접 진행 단계
 *
 * <p>면접은 다음 순서로 진행됩니다: WAITING → GREETING_PROMPT → GREETING → INTERVIEWER_INTRO → SELF_INTRO →
 * IN_PROGRESS → COMPLETED
 */
public enum InterviewStage {
    /** 연결 대기 (초기 상태) */
    WAITING,

    /** 인사 안내 단계 Frontend에서 "면접관에게 인사를 해주세요" UI 표시 및 안내 오디오 재생 */
    GREETING_PROMPT,

    /** 면접자 인사 단계 면접자가 면접관에게 인사하는 단계 (questionNumber=0으로 저장) */
    GREETING,

    /** 면접관 자기소개 단계 Persona와 면접관 수를 고려하여 LLM이 면접관 소개 생성 */
    INTERVIEWER_INTRO,

    /** 1분 30초 자기소개 단계 90초 동안 면접자의 자기소개를 듣고, 초과 시 면접관이 개입 */
    SELF_INTRO,

    /** 본 면접 진행 단계 일반적인 질문-답변 형식의 면접 진행 */
    IN_PROGRESS,

    /** 면접 완료 */
    COMPLETED
}
