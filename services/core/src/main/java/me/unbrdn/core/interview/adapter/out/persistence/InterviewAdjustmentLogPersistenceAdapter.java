package me.unbrdn.core.interview.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewAdjustmentLogJpaRepository;
import me.unbrdn.core.interview.application.port.out.SaveAdjustmentLogPort;
import me.unbrdn.core.interview.domain.entity.InterviewAdjustmentLog;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewAdjustmentLogPersistenceAdapter implements SaveAdjustmentLogPort {

    private final InterviewAdjustmentLogJpaRepository adjustmentLogRepository;
    private final InterviewMapper interviewMapper;

    @Override
    public void save(InterviewAdjustmentLog log) {
        var jpaEntity = interviewMapper.toJpaEntity(log);
        adjustmentLogRepository.save(jpaEntity);
    }
}
