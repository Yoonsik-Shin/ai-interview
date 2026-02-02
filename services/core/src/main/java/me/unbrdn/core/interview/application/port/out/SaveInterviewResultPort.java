package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.application.dto.command.SaveInterviewResultCommand;

/** 면접 결과를 PostgreSQL에 저장하기 위한 Port */
public interface SaveInterviewResultPort {
    void save(SaveInterviewResultCommand command);
}
