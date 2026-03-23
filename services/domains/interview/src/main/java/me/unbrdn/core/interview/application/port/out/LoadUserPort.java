package me.unbrdn.core.interview.application.port.out;

import java.util.UUID;

public interface LoadUserPort {
    boolean isCandidate(UUID userId);
}
