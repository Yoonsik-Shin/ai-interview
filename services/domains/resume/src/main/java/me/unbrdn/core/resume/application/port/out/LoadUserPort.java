package me.unbrdn.core.resume.application.port.out;

import java.util.UUID;

/** 사용자 조회 Output Port (Resume 모듈용) */
public interface LoadUserPort {

    boolean existsByUserId(UUID userId);
}
