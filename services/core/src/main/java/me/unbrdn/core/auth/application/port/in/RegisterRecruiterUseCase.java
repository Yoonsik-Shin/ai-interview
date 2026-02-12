package me.unbrdn.core.auth.application.port.in;

import java.util.UUID;
import me.unbrdn.core.auth.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterRecruiterCommand;

public interface RegisterRecruiterUseCase {
    /**
     * 채용담당자 회원가입
     *
     * @param command 회원가입 명령 (이메일, 비밀번호, 닉네임, 전화번호, 회사코드)
     * @return 생성된 사용자 ID
     * @throws UserAlreadyExistsException 이미 존재하는 이메일인 경우
     */
    UUID execute(RegisterRecruiterCommand command);
}
