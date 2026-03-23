package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.domain.entity.InterviewAdjustmentLog;

public interface SaveAdjustmentLogPort {
    void save(InterviewAdjustmentLog log);
}
