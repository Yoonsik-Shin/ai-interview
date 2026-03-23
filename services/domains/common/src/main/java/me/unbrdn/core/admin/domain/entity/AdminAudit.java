package me.unbrdn.core.admin.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.admin.domain.enums.AdminActionType;
import me.unbrdn.core.common.domain.BaseTimeEntity;

/**
 * 관리자 활동 로그 엔티티
 *
 * <p>Snapshot: admin_audit 테이블 - log_id (PK) - admin_id (FK to admin) - action_type: 액션 유형 (CREATE,
 * UPDATE, DELETE, LOGIN, etc.) - target_table: 대상 테이블명 - target_id: 대상 레코드 ID - description: 액션 설명
 * - ip_address: 접속 IP 주소 - created_at: 로그 생성 시각
 *
 * <p>목적: - 관리자의 모든 활동을 추적하여 보안 감사 지원 - 부정 접근, 데이터 변조 등을 탐지 - 규정 준수 (Compliance) 요구사항 충족
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AdminAudit extends BaseTimeEntity {

    private Admin admin;

    private AdminActionType actionType;

    private String targetTable;

    private String targetId;

    private String description;

    private String ipAddress;

    private AdminAudit(
            Admin admin,
            AdminActionType actionType,
            String targetTable,
            String targetId,
            String description,
            String ipAddress) {
        this.admin = admin;
        this.actionType = actionType;
        this.targetTable = targetTable;
        this.targetId = targetId;
        this.description = description;
        this.ipAddress = ipAddress;
    }

    /** 새로운 관리자 감사 로그 생성 */
    public static AdminAudit create(
            Admin admin,
            AdminActionType actionType,
            String targetTable,
            String targetId,
            String description,
            String ipAddress) {
        return new AdminAudit(admin, actionType, targetTable, targetId, description, ipAddress);
    }

    /** 로그인 로그 생성 (간소화 버전) */
    public static AdminAudit createLoginLog(Admin admin, String ipAddress) {
        return new AdminAudit(admin, AdminActionType.CREATE, null, null, "Admin login", ipAddress);
    }
}
