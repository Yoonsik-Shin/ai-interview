package me.unbrdn.core.interview.application.port.out;

import java.util.UUID;

public interface LoadResumePort {
    boolean exists(UUID resumeId);
}
