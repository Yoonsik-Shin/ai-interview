-- [CLEANUP] 사용하지 않는 레거시 테이블 삭제
-- interview_messages 테이블로 통합되었으므로 더 이상 필요하지 않은 interview_history, interview_results를 정리합니다.

DROP TABLE IF EXISTS interview_history;
DROP TABLE IF EXISTS interview_results;
