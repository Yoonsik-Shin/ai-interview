package me.unbrdn.core.interview.application.port.out;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;

public interface InterviewPort {

    /**
     * 면접 세션을 저장합니다.
     *
     * @param interviewSession 저장할 면접 세션
     * @return 저장된 면접 세션
     */
    InterviewSession save(InterviewSession interviewSession);

    /**
     * ID로 면접 세션을 조회합니다.
     *
     * @param interviewId 면접 ID (UUID)
     * @return 면접 세션 (없으면 Optional.empty())
     */
    Optional<InterviewSession> loadById(UUID interviewId);

    /**
     * 특정 사용자의 면접 세션 목록을 최신순으로 조회합니다.
     *
     * @param candidateId 사용자 ID (UUID)
     * @return 면접 세션 목록
     */
    List<InterviewSession> findByCandidateId(UUID candidateId);

    /**
     * 특정 사용자의 면접 세션 목록을 상태별로 필터링하여 최신순으로 조회합니다.
     *
     * @param candidateId 사용자 ID
     * @param statuses 조회할 상태 목록 (비어있으면 전체)
     * @param limit 조회 개수 제한 (0이면 전체)
     * @return 면접 세션 목록
     */
    List<InterviewSession> findAllByUserIdAndStatus(
            UUID candidateId, List<InterviewSessionStatus> statuses, int limit);
}
