package me.unbrdn.core.resume.application.port.in;

import java.util.UUID;
import me.unbrdn.core.resume.application.service.UpdateResumeCommand;

/**
 * 이력서 업데이트 UseCase 인터페이스
 *
 * <p>기존 이력서를 새 파일로 대체합니다.
 */
public interface UpdateResumeUseCase {

    /**
     * 기존 이력서를 업데이트합니다.
     *
     * @param command 업데이트 명령
     * @return 업데이트된 이력서 ID
     */
    UUID execute(UpdateResumeCommand command);
}
