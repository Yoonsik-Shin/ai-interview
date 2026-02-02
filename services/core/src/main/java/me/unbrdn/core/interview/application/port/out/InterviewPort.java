package me.unbrdn.core.interview.application.port.out;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.interview.domain.entity.InterviewSession;

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
}
