package me.unbrdn.core.admin.domain.enums;

/** 관리자 행위 유형 */
public enum AdminActionType {
    /** 생성 */
    CREATE,

    /** 수정 */
    UPDATE,

    /** 삭제 */
    DELETE,

    /** 부분 수정 */
    PATCH,

    /** 전체 수정 */
    PUT
}
